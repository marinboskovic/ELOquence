"""Public player profiles — ``/api/profiles/{username}``.

Read-only, no e-mail or ids of other people's data, and opt-out via the
``profile_public`` account setting. Guesses are never included for in-progress
games and only pattern grids (no letters) are shown for the recent games
strip, exactly like a Wordle share card.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.achievement import Achievement
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.user import User
from app.services.auth import get_optional_user
from app.services.rate_limit import rate_limited

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("/{username}", dependencies=[rate_limited("profile", 120, 600)])
async def public_profile(
    username: str,
    viewer: Annotated[User | None, Depends(get_optional_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    if len(username) > 30:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found.")
    user = (
        await db.execute(select(User).where(func.lower(User.username) == username.lower()))
    ).scalar_one_or_none()
    if user is None or user.is_banned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found.")

    is_me = viewer is not None and viewer.id == user.id
    if not user.profile_public and not is_me and not (viewer and viewer.is_admin):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="This profile is private.")

    # Aggregates over finished games
    agg = (
        await db.execute(
            select(
                func.count().label("completed"),
                func.sum(case((Game.status == "won", 1), else_=0)).label("wins"),
                func.avg(case((Game.status == "won", Game.num_guesses), else_=None)).label("avg_guesses"),
                func.avg(Game.accuracy_score).label("avg_accuracy"),
                func.max(Game.accuracy_score).label("best_accuracy"),
            ).where(Game.user_id == user.id, Game.status.in_(["won", "lost"]))
        )
    ).one()

    dist_rows = (
        await db.execute(
            select(Game.num_guesses, func.count())
            .where(Game.user_id == user.id, Game.status == "won")
            .group_by(Game.num_guesses)
        )
    ).all()
    distribution = {str(i): 0 for i in range(1, 7)}
    for n, c in dist_rows:
        if n and 1 <= n <= 6:
            distribution[str(n)] = int(c)

    # Favourite opener
    from app.models.move import Move

    opener_row = (
        await db.execute(
            select(func.upper(Move.guess_word), func.count())
            .join(Game, Game.id == Move.game_id)
            .where(Game.user_id == user.id, Move.move_number == 1, Game.status.in_(["won", "lost"]))
            .group_by(func.upper(Move.guess_word))
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()

    peak = (
        await db.execute(select(func.max(EloHistory.elo_after)).where(EloHistory.user_id == user.id))
    ).scalar_one()

    achievements = (
        await db.execute(
            select(Achievement.achievement_type, Achievement.unlocked_at)
            .where(Achievement.user_id == user.id)
            .order_by(Achievement.unlocked_at.desc())
        )
    ).all()

    recent = (
        await db.execute(
            select(Game)
            .options(selectinload(Game.moves))
            .where(Game.user_id == user.id, Game.status.in_(["won", "lost"]))
            .order_by(Game.completed_at.desc())
            .limit(10)
        )
    ).scalars().all()

    # ELO sparkline (last 30 rated games)
    history = (
        await db.execute(
            select(EloHistory.elo_after, EloHistory.recorded_at)
            .where(EloHistory.user_id == user.id)
            .order_by(EloHistory.recorded_at.desc())
            .limit(30)
        )
    ).all()

    from app.services.elo import effective_streak

    completed = int(agg.completed or 0)
    wins = int(agg.wins or 0)
    return {
        "username": user.username,
        "avatar_url": user.avatar_url,
        "is_me": is_me,
        "member_since": user.created_at.isoformat() if user.created_at else None,
        "elo_rating": user.elo_rating,
        "peak_elo": float(peak) if peak is not None else user.elo_rating,
        "is_placement": user.is_placement,
        "rated_games": user.games_played,
        "current_streak": effective_streak(user),
        "max_streak": user.max_streak,
        "completed": completed,
        "wins": wins,
        "win_rate": round(wins / completed * 100, 1) if completed else 0.0,
        "avg_guesses": round(float(agg.avg_guesses), 2) if agg.avg_guesses is not None else None,
        "avg_accuracy": round(float(agg.avg_accuracy), 1) if agg.avg_accuracy is not None else None,
        "best_accuracy": round(float(agg.best_accuracy), 1) if agg.best_accuracy is not None else None,
        "favourite_opener": opener_row[0] if opener_row else None,
        "favourite_opener_plays": int(opener_row[1]) if opener_row else 0,
        "guess_distribution": distribution,
        "achievements": [{"type": t, "unlocked_at": at.isoformat() if at else None} for t, at in achievements],
        "elo_history": [{"elo": e, "at": at.isoformat() if at else None} for e, at in reversed(history)],
        "recent_games": [
            {
                "id": str(g.id),
                "mode": g.mode,
                "status": g.status,
                "num_guesses": g.num_guesses,
                "hard_mode": g.hard_mode,
                "accuracy_score": g.accuracy_score,
                "elo_delta": g.elo_delta,
                "completed_at": g.completed_at.isoformat() if g.completed_at else None,
                "patterns": [m.pattern for m in sorted(g.moves, key=lambda m: m.move_number)],
            }
            for g in recent
        ],
    }
