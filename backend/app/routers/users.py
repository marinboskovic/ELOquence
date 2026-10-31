"""Users router — per-user ELO history and detailed stats."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.achievement import Achievement
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.schemas.user import UpdateProfileRequest, UserResponse
from app.services.auth import get_current_user, verify_password
from app.services.rate_limit import rate_limited


class _PasswordConfirm(BaseModel):
    """Body schema for step-up auth on destructive endpoints.

    Local-password users must re-supply their password. Google-only users
    (no `password_hash`) confirm by sending a token field equal to their
    username — the rationale being that they've already proven Google
    ownership at login and we just want a deliberate, copy-paste-resistant
    confirmation step.
    """

    password: str | None = Field(default=None, min_length=1, max_length=200)
    confirm_username: str | None = Field(default=None, max_length=80)


async def _require_step_up(user: User, body: _PasswordConfirm) -> None:
    """Block destructive actions unless the caller proves fresh possession.

    Raises 401 on missing/wrong credentials so a stolen Bearer alone is
    never enough to wipe an account or its history.
    """
    if user.password_hash:
        if not body.password or not await verify_password(body.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Password confirmation required.",
            )
    else:
        # Google-only account: ask for username re-entry as a deliberate confirm step.
        if not body.confirm_username or body.confirm_username.strip().lower() != (user.username or "").lower():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username confirmation required.",
            )

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/elo-history")
async def elo_history(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    days: int = Query(default=30, ge=1, le=365),
) -> list[dict]:
    """Return the authenticated user's ELO history for the past N days.

    Args:
        current_user: The currently authenticated user.
        db: Async database session.
        days: Number of past days to include (1–365, default 30).

    Returns:
        List of ELO change events ordered by recorded_at ascending.
    """
    cutoff = datetime.now(UTC) - timedelta(days=days)
    result = await db.execute(
        select(EloHistory)
        .where(
            EloHistory.user_id == current_user.id,
            EloHistory.recorded_at >= cutoff,
        )
        .order_by(EloHistory.recorded_at.asc())
    )
    entries = result.scalars().all()
    return [
        {
            "elo_before": e.elo_before,
            "elo_after": e.elo_after,
            "delta": e.delta,
            "accuracy_score": e.accuracy_score,
            "recorded_at": e.recorded_at.isoformat(),
        }
        for e in entries
    ]


@router.get("/me/stats")
async def user_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Return detailed player stats including guess distribution and mode breakdown.

    Args:
        current_user: The currently authenticated user.
        db: Async database session.

    Returns:
        Dict with guess_distribution, losses, avg_accuracy, mode_stats,
        best_accuracy, total_games, current_streak, and longest_streak.

        ``mode_stats`` is keyed by mode (``daily``/``competitive``/
        ``practice``/``challenge``) plus an ``all`` aggregate; each value is
        ``{completed, wins, losses, win_rate, avg_guesses, distribution}``
        computed over the player's entire history.
    """
    # ------------------------------------------------------------------
    # Single grouped pass over every completed (won/lost) game. All the
    # per-mode aggregates the dashboard needs — completed counts, wins,
    # losses, guess distribution and average guesses — are derived from
    # this one result set, NOT from the most-recent-N games the client
    # happens to have fetched. The old approach left two bugs:
    #   * the dashboard counted modes over its 20-game window, so a daily
    #     pushed out of that window showed up as 0 even with a live streak;
    #   * the per-mode `won = gained ELO` definition only made sense for
    #     rated competitive games and reported 0 wins for daily/practice.
    # `challenge` is included here; it was previously omitted entirely.
    # ------------------------------------------------------------------
    MODES = ("daily", "competitive", "practice", "challenge")

    grouped = await db.execute(
        select(Game.mode, Game.status, Game.num_guesses, func.count())
        .where(
            Game.user_id == current_user.id,
            Game.status.in_(["won", "lost"]),
        )
        .group_by(Game.mode, Game.status, Game.num_guesses)
    )

    def _blank() -> dict:
        return {
            "completed": 0,
            "wins": 0,
            "losses": 0,
            "guess_sum": 0,
            "distribution": {str(i): 0 for i in range(1, 7)},
        }

    per_mode: dict[str, dict] = {m: _blank() for m in MODES}
    overall = _blank()

    for mode, game_status, num_guesses, count in grouped.all():
        buckets = [overall]
        if mode in per_mode:
            buckets.append(per_mode[mode])
        for b in buckets:
            b["completed"] += count
            if game_status == "won":
                b["wins"] += count
                b["guess_sum"] += (num_guesses or 0) * count
                if num_guesses and 1 <= num_guesses <= 6:
                    b["distribution"][str(num_guesses)] += count
            else:  # lost
                b["losses"] += count

    def _finalize(b: dict) -> dict:
        wins, completed = b["wins"], b["completed"]
        return {
            "completed": completed,
            "wins": wins,
            "losses": b["losses"],
            "win_rate": round(wins / completed * 100, 1) if completed else 0.0,
            "avg_guesses": round(b["guess_sum"] / wins, 2) if wins else None,
            "distribution": b["distribution"],
        }

    mode_stats: dict[str, dict] = {m: _finalize(per_mode[m]) for m in MODES}
    mode_stats["all"] = _finalize(overall)

    # Top-level overall fields, kept for backward compatibility.
    guess_dist = overall["distribution"]
    losses = overall["losses"]

    # Average accuracy across all completed games that have an accuracy score
    avg_acc_result = await db.execute(
        select(func.avg(Game.accuracy_score)).where(
            Game.user_id == current_user.id,
            Game.accuracy_score.isnot(None),
        )
    )
    avg_accuracy: float = avg_acc_result.scalar_one() or 0.0

    # Best single-game accuracy
    best_result = await db.execute(
        select(Game.accuracy_score, Game.target_word)
        .where(
            Game.user_id == current_user.id,
            Game.accuracy_score.isnot(None),
        )
        .order_by(Game.accuracy_score.desc())
        .limit(1)
    )
    best = best_result.first()

    # ── 2.0 additions ───────────────────────────────────────────────────
    # Nemesis words: the words this player has failed on (most recent first,
    # grouped so a word lost twice counts twice).
    nemesis_rows = await db.execute(
        select(Game.target_word, func.count(), func.max(Game.completed_at), func.max(Game.word_difficulty))
        .where(Game.user_id == current_user.id, Game.status == "lost")
        .group_by(Game.target_word)
        .order_by(func.count().desc(), func.max(Game.completed_at).desc())
        .limit(8)
    )
    nemesis = [
        {
            "word": w,
            "losses": int(c),
            "last_lost_at": at.isoformat() if at else None,
            "difficulty": round(float(d)) if d is not None else None,
        }
        for w, c, at, d in nemesis_rows.all()
    ]

    # Pace: server-measured solve times on wins.
    pace_row = (
        await db.execute(
            select(
                func.avg(Game.time_seconds),
                func.min(Game.time_seconds),
                func.count(),
            ).where(
                Game.user_id == current_user.id,
                Game.status == "won",
                Game.time_seconds.isnot(None),
            )
        )
    ).one()
    fastest = None
    if pace_row[1] is not None:
        fastest_game = (
            await db.execute(
                select(Game.target_word, Game.num_guesses, Game.time_seconds, Game.mode)
                .where(Game.user_id == current_user.id, Game.status == "won", Game.time_seconds == pace_row[1])
                .limit(1)
            )
        ).first()
        if fastest_game:
            fastest = {
                "word": fastest_game[0],
                "num_guesses": fastest_game[1],
                "seconds": round(float(fastest_game[2]), 1),
                "mode": fastest_game[3],
            }

    # Favourite opener + its personal solve rate
    opener_row = (
        await db.execute(
            select(
                func.upper(Move.guess_word),
                func.count(),
                func.sum(case((Game.status == "won", 1), else_=0)),
            )
            .join(Game, Game.id == Move.game_id)
            .where(Game.user_id == current_user.id, Move.move_number == 1, Game.status.in_(["won", "lost"]))
            .group_by(func.upper(Move.guess_word))
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()

    # Classification mix over all analysed moves (what kind of player you are)
    cls_rows = (
        await db.execute(
            select(Move.classification, func.count())
            .join(Game, Game.id == Move.game_id)
            .where(Game.user_id == current_user.id, Move.classification.isnot(None))
            .group_by(Move.classification)
        )
    ).all()

    from app.services.elo import effective_streak

    return {
        "guess_distribution": guess_dist,
        "losses": losses,
        "avg_accuracy": round(avg_accuracy, 1),
        "mode_stats": mode_stats,
        "best_accuracy": {"score": best[0], "word": best[1]} if best else None,
        "total_games": current_user.games_played,
        "current_streak": effective_streak(current_user),
        "longest_streak": current_user.max_streak,
        "nemesis_words": nemesis,
        "pace": {
            "avg_win_seconds": round(float(pace_row[0]), 1) if pace_row[0] is not None else None,
            "timed_wins": int(pace_row[2] or 0),
            "fastest_win": fastest,
        },
        "favourite_opener": {
            "word": opener_row[0],
            "plays": int(opener_row[1]),
            "solve_rate": round(int(opener_row[2] or 0) / int(opener_row[1]) * 100, 1) if opener_row[1] else 0.0,
        }
        if opener_row
        else None,
        "classification_mix": {c: int(n) for c, n in cls_rows},
    }


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    payload: UpdateProfileRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserResponse:
    """Change username and/or profile visibility."""
    if payload.username is not None and payload.username.lower() != (current_user.username or "").lower():
        taken = await db.execute(
            select(User.id).where(func.lower(User.username) == payload.username.lower(), User.id != current_user.id)
        )
        if taken.scalar_one_or_none():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That username is taken.")
        # Renames are throttled: 3 per day keeps leaderboard identities stable.
        from app.services.rate_limit import check_rate_limit, too_many

        blocked = check_rate_limit(f"rename:{current_user.id}", 3, 86400)
        if blocked is not None:
            raise too_many(blocked, "You can change your username up to 3 times per day.")
        current_user.username = payload.username
    elif payload.username is not None:
        current_user.username = payload.username  # case-only change
    if payload.profile_public is not None:
        current_user.profile_public = payload.profile_public
    await db.flush()
    from app.services.elo import effective_streak

    data = UserResponse.model_validate(current_user)
    data.current_streak = effective_streak(current_user)
    return data


@router.get("/me/export", dependencies=[rate_limited("export", 5, 3600, key="user")])
async def export_my_data(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    """Download everything we store about you as JSON (GDPR data portability)."""
    from sqlalchemy.orm import selectinload

    games = (
        await db.execute(
            select(Game).options(selectinload(Game.moves)).where(Game.user_id == current_user.id).order_by(Game.created_at.asc())
        )
    ).scalars().all()
    history = (
        await db.execute(
            select(EloHistory).where(EloHistory.user_id == current_user.id).order_by(EloHistory.recorded_at.asc())
        )
    ).scalars().all()
    achievements = (
        await db.execute(select(Achievement).where(Achievement.user_id == current_user.id))
    ).scalars().all()

    def iso(dt):  # noqa: ANN001
        return dt.isoformat() if dt else None

    payload = {
        "exported_at": datetime.now(UTC).isoformat(),
        "format_version": 1,
        "account": {
            "id": str(current_user.id),
            "email": current_user.email,
            "username": current_user.username,
            "created_at": iso(current_user.created_at),
            "elo_rating": current_user.elo_rating,
            "games_played": current_user.games_played,
            "current_streak": current_user.current_streak,
            "max_streak": current_user.max_streak,
            "profile_public": current_user.profile_public,
            "google_linked": current_user.google_id is not None,
        },
        "games": [
            {
                "id": str(g.id),
                "mode": g.mode,
                "status": g.status,
                "target_word": g.target_word if g.status in ("won", "lost") or g.mode in ("competitive", "practice") else None,
                "hard_mode": g.hard_mode,
                "num_guesses": g.num_guesses,
                "time_seconds": g.time_seconds,
                "accuracy_score": g.accuracy_score,
                "luck_factor": g.luck_factor,
                "elo_before": g.elo_before,
                "elo_after": g.elo_after,
                "elo_delta": g.elo_delta,
                "created_at": iso(g.created_at),
                "completed_at": iso(g.completed_at),
                "moves": [
                    {
                        "move_number": m.move_number,
                        "guess": m.guess_word,
                        "pattern": m.pattern,
                        "classification": m.classification,
                        "info_gained": m.info_gained,
                        "optimal_word": m.optimal_word if g.status != "in_progress" else None,
                    }
                    for m in sorted(g.moves, key=lambda m: m.move_number)
                ],
            }
            for g in games
        ],
        "elo_history": [
            {
                "elo_before": h.elo_before,
                "elo_after": h.elo_after,
                "delta": h.delta,
                "accuracy_score": h.accuracy_score,
                "recorded_at": iso(h.recorded_at),
            }
            for h in history
        ],
        "achievements": [{"type": a.achievement_type, "unlocked_at": iso(a.unlocked_at)} for a in achievements],
    }
    filename = f"eloquence-export-{current_user.username}.json"
    return JSONResponse(content=payload, headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.delete("/me/games")
async def delete_all_games(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: Annotated[_PasswordConfirm, Body()] = _PasswordConfirm(),
) -> dict:
    """Delete all past games for the current user.

    Requires step-up auth (password re-entry or username confirmation) so a
    stolen Bearer alone cannot wipe history.

    ELO rating and ELO history are preserved — players cannot manipulate
    their rating by deleting games.

    Deletion order respects FK constraints:
    1. Moves (FK → games)
    2. Games

    After deletion the streak counters and games_played are reset.

    Args:
        current_user: The currently authenticated user.
        db: Async database session.

    Returns:
        Dict with a confirmation message and the number of games deleted.
    """
    await _require_step_up(current_user, body)

    game_ids_result = await db.execute(
        select(Game.id).where(Game.user_id == current_user.id)
    )
    game_ids = game_ids_result.scalars().all()
    games_deleted = len(game_ids)

    if game_ids:
        # 1. Delete moves that belong to the user's games.
        await db.execute(
            delete(Move).where(Move.game_id.in_(game_ids))
        )

        # 2. Null out game_id references in ELO history (keep the history).
        await db.execute(
            EloHistory.__table__.update()
            .where(EloHistory.user_id == current_user.id)
            .values(game_id=None)
        )

        # 3. Delete the games themselves.
        await db.execute(
            delete(Game).where(Game.user_id == current_user.id)
        )

    # Reset game-related counters but preserve ELO.
    current_user.games_played = 0
    current_user.current_streak = 0
    current_user.max_streak = 0
    current_user.last_played_date = None

    await db.commit()

    return {"message": "All game data deleted", "games_deleted": games_deleted}


@router.delete("/me")
async def delete_account(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    body: Annotated[_PasswordConfirm, Body()] = _PasswordConfirm(),
) -> dict:
    """Permanently delete the authenticated user's account and all associated data.

    Requires step-up auth (password re-entry, or username confirmation for
    Google-only accounts). A stolen Bearer cannot delete an account on its
    own.

    Deletion order respects FK constraints:
    1. Moves (via game_id subquery)
    2. EloHistory (by user_id, before games are dropped)
    3. Games (by user_id)
    4. User record

    Args:
        current_user: The currently authenticated user.
        db: Async database session.
        body: Step-up confirmation (password or username).

    Returns:
        Dict with a confirmation message.
    """
    await _require_step_up(current_user, body)

    # Resolve the user's game IDs once so we can bulk-delete moves.
    game_ids_result = await db.execute(
        select(Game.id).where(Game.user_id == current_user.id)
    )
    game_ids = game_ids_result.scalars().all()

    if game_ids:
        # 1. Delete moves belonging to the user's games.
        await db.execute(
            delete(Move).where(Move.game_id.in_(game_ids))
        )

    # 2. Delete all ELO history rows for this user (must precede game deletion
    #    because elo_history.game_id uses ondelete=SET NULL, not CASCADE).
    await db.execute(
        delete(EloHistory).where(EloHistory.user_id == current_user.id)
    )

    if game_ids:
        # 3. Delete the games.
        await db.execute(
            delete(Game).where(Game.user_id == current_user.id)
        )

    # 4. Delete achievements.
    await db.execute(
        delete(Achievement).where(Achievement.user_id == current_user.id)
    )

    # 5. Delete the user record itself.
    await db.delete(current_user)

    await db.commit()

    return {"message": "Account deleted"}
