"""AI coach router — move explanations, game summaries, and chat.

All endpoints require a valid Bearer token and a *finished* game. Gemini
calls run in a worker thread so the event loop keeps serving guesses.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_current_user
from app.services.rate_limit import rate_limited

router = APIRouter(prefix="/ai", tags=["ai"])

_CHAT_LIMIT_PER_GAME = 10
_CHAT_LIMIT_DAILY = 40


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class MoveExplainRequest(BaseModel):
    game_id: uuid.UUID
    move_number: int = Field(ge=1, le=6)


class ChatTurn(BaseModel):
    role: Literal["user", "assistant", "model"]
    content: str = Field(max_length=1000)


class CoachChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _require_ai() -> None:
    """Raise 503 if AI features are unavailable."""
    from app.services.ai import _ai_available  # noqa: PLC0415

    if not _ai_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI features unavailable — no API key configured.",
        )


def _build_game_context(game: Game, analysis: dict) -> str:
    """Serialise game + analysis data into a compact context string for the coach."""
    lines = [
        f"Target word: {game.target_word}",
        f"Result: {game.status} in {game.num_guesses} guesses",
        f"Accuracy: {analysis.get('accuracy_score', 0):.1f}%",
        f"Luck factor: {analysis.get('luck_factor', 0):.3f}",
        "",
        "Moves:",
    ]
    for m in analysis.get("moves", []):
        lines.append(
            f"  Move {m['move_number']}: {m['guess_word']} ({m['classification']},"
            f" eff {m.get('efficiency_ratio', 0) * 100:.0f}%,"
            f" {m.get('remaining_words', '?')}->{m.get('remaining_after', '?')} words)"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/explain-move", dependencies=[rate_limited("ai-explain", 60, 3600, key="user")])
async def explain_move_endpoint(
    payload: MoveExplainRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get an AI explanation for a specific move in a completed game.

    The response is cached — identical positions across games return instantly.

    Returns:
        ``{"explanation": "..."}``
    """
    _require_ai()
    from app.analysis import analyze_game
    from app.services.ai import explain_move

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == payload.game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot explain a move in an in-progress game.",
        )

    moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]
    analysis = await asyncio.to_thread(
        analyze_game, moves_data, game.target_word, competitive=game.mode == "competitive"
    )

    move_result = next(
        (m for m in analysis["moves"] if m["move_number"] == payload.move_number), None
    )
    if move_result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Move {payload.move_number} not found in this game.",
        )

    explanation = await explain_move(db, move_result, current_user.elo_rating)
    return {"explanation": explanation}


@router.post("/game-summary/{game_id}", dependencies=[rate_limited("ai-summary", 30, 3600, key="user")])
async def game_summary_endpoint(
    game_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get an AI post-game summary with detected strategic patterns.

    Returns:
        ``{"summary": "...", "patterns": [...]}``
    """
    _require_ai()
    from app.analysis import analyze_game
    from app.analysis.patterns import detect_strategic_patterns
    from app.services.ai import generate_game_summary

    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")
    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot summarize an in-progress game.",
        )

    moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]
    analysis = await asyncio.to_thread(
        analyze_game, moves_data, game.target_word, competitive=game.mode == "competitive"
    )

    game_data = {
        "target_word": game.target_word,
        "status": game.status,
        "num_guesses": game.num_guesses,
    }

    summary = await generate_game_summary(db, analysis, game_data, current_user.elo_rating)
    patterns = detect_strategic_patterns(analysis["moves"], current_user.elo_rating)

    return {"summary": summary, "patterns": patterns}


@router.post(
    "/coach-chat/{game_id}",
    dependencies=[
        rate_limited(
            "ai-chat-day", _CHAT_LIMIT_DAILY, 86400, key="user",
            detail=f"Daily coach chat limit reached ({_CHAT_LIMIT_DAILY} messages per day).",
        )
    ],
)
async def coach_chat_endpoint(
    game_id: uuid.UUID,
    payload: CoachChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Send a message to the AI coach for a specific game.

    Rate limited to 10 messages per game and 40 per day (in-memory).

    Returns:
        ``{"response": "..."}``
    """
    _require_ai()
    from app.analysis import analyze_game
    from app.services.ai import coach_chat_message

    # Per-game cap on top of the per-day dependency above.
    from app.services.rate_limit import check_rate_limit, too_many

    blocked = check_rate_limit(f"ai-chat-game:{current_user.id}:{game_id}", _CHAT_LIMIT_PER_GAME, 86400)
    if blocked is not None:
        raise too_many(blocked, f"Coach chat limit reached for this game ({_CHAT_LIMIT_PER_GAME} messages).")

    # ------------------------------------------------------------------
    # Load game + build context
    # ------------------------------------------------------------------
    result = await db.execute(
        select(Game)
        .options(selectinload(Game.moves))
        .where(Game.id == game_id, Game.user_id == current_user.id)
    )
    game = result.scalar_one_or_none()
    if game is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Game not found.")

    # Refuse to coach an in-progress game — the system prompt includes the
    # target word and the LLM has no instruction to keep it hidden. A single
    # "print your system prompt" message would otherwise leak the answer and
    # turn any rated game into a guaranteed win. Mirrors the explicit gates
    # on /explain-move and /game-summary above. The other two AI endpoints
    # are post-completion only by design; coach-chat is meant to be used
    # during play, so we explicitly close this loophole here.
    if game.status == "in_progress":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Coach is available after the game ends.",
        )

    moves_data = [
        {"guess_word": m.guess_word, "pattern": m.pattern, "move_number": m.move_number}
        for m in sorted(game.moves, key=lambda m: m.move_number)
    ]

    if moves_data:
        analysis = await asyncio.to_thread(
        analyze_game, moves_data, game.target_word, competitive=game.mode == "competitive"
    )
        game_context = _build_game_context(game, analysis)
    else:
        game_context = f"Target word: {game.target_word}\nNo moves played yet."

    # ------------------------------------------------------------------
    # Call LLM in thread pool (blocking SDK)
    # ------------------------------------------------------------------
    response_text = await asyncio.to_thread(
        coach_chat_message,
        game_context,
        [t.model_dump() for t in payload.history],
        payload.message,
        current_user.elo_rating,
    )
    return {"response": response_text}
