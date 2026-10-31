"""Challenges router — create and play shareable word challenges.

Every attempt is a ``Game`` with ``mode="challenge"`` linked by
``Game.challenge_id`` (not by target word — two challenges may share a word).

Word-reveal policy: the target word is returned only to a player whose own
attempt is finished (won/lost). Creators do not get a free look either —
they can play their own challenge like everyone else.
"""
from __future__ import annotations

import random
import secrets
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.challenge import Challenge
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_current_user
from app.services.rate_limit import rate_limited

router = APIRouter(prefix="/challenges", tags=["challenges"])

_FINISHED = ("won", "lost")


async def _load_challenge(db: AsyncSession, code: str) -> Challenge:
    if len(code) > 16:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")
    c = (await db.execute(select(Challenge).where(Challenge.code == code))).scalar_one_or_none()
    if c is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found.")
    return c


async def _own_attempt(db: AsyncSession, challenge: Challenge, user: User) -> Game | None:
    """The user's non-abandoned attempt at this challenge, if any."""
    rows = (
        await db.execute(
            select(Game)
            .where(
                Game.user_id == user.id,
                Game.challenge_id == challenge.id,
                Game.status != "abandoned",
            )
            .order_by(Game.created_at.desc())
        )
    ).scalars().all()
    return rows[0] if rows else None


@router.get("/mine")
async def my_challenges(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Challenges the user created or played. The word is included only
    for challenges where the user's own attempt is finished."""
    created = (
        await db.execute(select(Challenge).where(Challenge.creator_id == current_user.id))
    ).scalars().all()
    attempts = (
        await db.execute(
            select(Game).where(Game.user_id == current_user.id, Game.challenge_id.isnot(None))
        )
    ).scalars().all()
    attempt_by_challenge: dict[uuid.UUID, Game] = {}
    for g in attempts:
        prev = attempt_by_challenge.get(g.challenge_id)
        if prev is None or (g.status in _FINISHED and prev.status not in _FINISHED):
            attempt_by_challenge[g.challenge_id] = g

    by_id: dict[uuid.UUID, Challenge] = {c.id: c for c in created}
    missing = [cid for cid in attempt_by_challenge if cid not in by_id]
    if missing:
        for c in (await db.execute(select(Challenge).where(Challenge.id.in_(missing)))).scalars().all():
            by_id[c.id] = c

    out = sorted(by_id.values(), key=lambda c: c.created_at or datetime.min, reverse=True)
    result = []
    for c in out:
        attempt = attempt_by_challenge.get(c.id)
        finished = attempt is not None and attempt.status in _FINISHED
        result.append(
            {
                "code": c.code,
                "challenge_id": str(c.id),
                "target_word": c.target_word if finished else None,
                "word_difficulty": c.word_difficulty,
                "is_creator": c.creator_id == current_user.id,
                "my_status": attempt.status if attempt else None,
                "my_game_id": str(attempt.id) if attempt else None,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
        )
    return result


@router.post(
    "/create",
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limited("challenge-create", 20, 3600, key="user")],
)
async def create_challenge(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Create a challenge around a random word and return its share code."""
    from app.analysis.engine import ANSWERS
    from app.services.word_difficulty import word_to_elo

    if not ANSWERS:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Word lists not loaded.")

    word = random.choice(ANSWERS).upper()
    code = secrets.token_urlsafe(8)  # 11 URL-safe chars, ~64 bits
    challenge = Challenge(
        id=uuid.uuid4(),
        creator_id=current_user.id,
        target_word=word,
        word_difficulty=word_to_elo(word),
        code=code,
    )
    db.add(challenge)
    await db.flush()
    return {"code": code, "challenge_id": str(challenge.id)}


@router.get("/{code}")
async def get_challenge(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Challenge metadata (never the word) + the caller's own attempt state."""
    c = await _load_challenge(db, code)
    creator = (await db.execute(select(User.username).where(User.id == c.creator_id))).scalar_one_or_none()
    attempt = await _own_attempt(db, c, current_user)
    return {
        "code": c.code,
        "creator_id": str(c.creator_id),
        "creator_username": creator,
        "is_creator": c.creator_id == current_user.id,
        "word_difficulty": c.word_difficulty,
        "already_played": attempt is not None,
        "my_status": attempt.status if attempt else None,
        "game_id": str(attempt.id) if attempt else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


@router.post("/{code}/play", status_code=status.HTTP_201_CREATED)
async def play_challenge(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Start (or resume) the caller's attempt at a challenge. Unrated."""
    from app.routers.games import _build_game_response
    from app.services.game import abandon_game

    c = await _load_challenge(db, code)

    # Serialise per (user, challenge) so double-clicks can't open two attempts.
    from sqlalchemy import text

    from app.services.game import _create_game_lock_key

    await db.execute(
        text("SELECT pg_advisory_xact_lock(:k)"), {"k": _create_game_lock_key(current_user.id, f"challenge:{c.id}")}
    )

    existing = await _own_attempt(db, c, current_user)
    if existing is not None:
        if existing.status == "in_progress":
            await db.refresh(existing, ["moves"])
            return _build_game_response(existing).model_dump()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You have already played this challenge.")

    # Abandon any other in-progress challenge attempt so it doesn't linger.
    stale = await db.execute(
        select(Game).where(
            Game.user_id == current_user.id,
            Game.mode == "challenge",
            Game.status == "in_progress",
        )
    )
    for stale_game in stale.scalars().all():
        await abandon_game(db, stale_game.id, current_user)

    game = Game(
        id=uuid.uuid4(),
        user_id=current_user.id,
        mode="challenge",
        challenge_id=c.id,
        target_word=c.target_word,
        word_difficulty=c.word_difficulty,
        status="in_progress",
        num_guesses=0,
        rated=False,
        is_placement=False,
        constraint_violations=0,
        traps_encountered=0,
    )
    db.add(game)
    await db.flush()
    await db.refresh(game, ["moves"])
    return _build_game_response(game).model_dump()


@router.get("/{code}/results")
async def challenge_results(
    code: str,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Ranked results. Wins first (fewest guesses, then accuracy, then
    time), then losses. The word is revealed only when the caller's own
    attempt is finished."""
    c = await _load_challenge(db, code)

    rows = list(
        (
            await db.execute(
                select(Game, User.username)
                .join(User, Game.user_id == User.id)
                .options(selectinload(Game.moves))
                .where(Game.challenge_id == c.id, Game.status != "abandoned")
            )
        ).all()
    )

    def sort_key(item):
        game, _ = item
        won = game.status == "won"
        return (
            0 if won else 1,
            game.num_guesses if won else 6,
            -(game.accuracy_score or 0.0),
            game.time_seconds if game.time_seconds is not None else float("inf"),
            game.completed_at or datetime.max,
        )

    ranked_rows = sorted([(g, u) for g, u in rows if g.status in _FINISHED], key=sort_key)
    in_progress_rows = [(g, u) for g, u in rows if g.status == "in_progress"]

    my_attempt = next((g for g, _ in rows if g.user_id == current_user.id), None)
    reveal = my_attempt is not None and my_attempt.status in _FINISHED

    entries = []
    for rank, (game, username) in enumerate(ranked_rows, start=1):
        entries.append(
            {
                "rank": rank,
                "username": username,
                "status": game.status,
                "num_guesses": game.num_guesses,
                "accuracy_score": game.accuracy_score,
                "time_seconds": game.time_seconds,
                "is_creator": game.user_id == c.creator_id,
                "is_me": game.user_id == current_user.id,
                "completed_at": game.completed_at.isoformat() if game.completed_at else None,
                # Pattern-only grid (no letters) — safe to show to everyone,
                # like Wordle's emoji share.
                "patterns": [m.pattern for m in sorted(game.moves, key=lambda m: m.move_number)] if reveal else None,
            }
        )
    for game, username in in_progress_rows:
        entries.append(
            {
                "rank": None,
                "username": username,
                "status": game.status,
                "num_guesses": game.num_guesses,
                "accuracy_score": None,
                "time_seconds": None,
                "is_creator": game.user_id == c.creator_id,
                "is_me": game.user_id == current_user.id,
                "completed_at": None,
                "patterns": None,
            }
        )

    return {
        "code": c.code,
        "word": c.target_word if reveal else None,
        "my_status": my_attempt.status if my_attempt else None,
        "my_game_id": str(my_attempt.id) if my_attempt else None,
        "results": entries,
    }
