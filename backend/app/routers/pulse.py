"""Public ``/api/pulse`` — the numbers that feed the landing-page ticker.

Everything here is aggregate and already public elsewhere (leaderboard,
word statistics), so no auth. Today's daily word is never included —
only counts about it. Cached in-process for 60 s because the landing page
is the most-hit route and none of this needs to be live to the second.
"""
from __future__ import annotations

import calendar
import time
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.achievement import Achievement
from app.models.daily_word import DailyWord
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.services.achievements import ALL_ACHIEVEMENTS
from app.services.rate_limit import rate_limited

_ACH_NAME = {a["type"]: a["name"] for a in ALL_ACHIEVEMENTS}

router = APIRouter(prefix="/pulse", tags=["pulse"])

_CACHE: dict[str, Any] = {"at": 0.0, "data": None}
_TTL_SECONDS = 60


@router.get("/", dependencies=[rate_limited("pulse", 120, 60)])
async def pulse(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    now = time.monotonic()
    if _CACHE["data"] is not None and now - _CACHE["at"] < _TTL_SECONDS:
        return _CACHE["data"]

    utc_now = datetime.now(UTC)
    today = utc_now.date()
    since_36h = utc_now - timedelta(hours=36)
    week_ago = utc_now - timedelta(days=7)

    # ── Today's daily: counts only, never the word ────────────────────────
    daily_row = (await db.execute(select(DailyWord.word).where(DailyWord.date == today))).scalar_one_or_none()
    today_daily: dict | None = None
    if daily_row:
        word = daily_row.upper()
        r = (
            await db.execute(
                select(
                    func.count(func.distinct(Game.user_id)).label("players"),
                    func.sum(case((Game.status == "won", 1), else_=0)).label("solved"),
                    func.avg(case((Game.status == "won", Game.num_guesses), else_=None)).label("avg_guesses"),
                    func.min(case((Game.status == "won", Game.time_seconds), else_=None)).label("fastest"),
                ).where(
                    Game.mode == "daily",
                    Game.target_word == word,
                    Game.created_at >= since_36h,
                    Game.status.in_(("won", "lost")),
                )
            )
        ).one()
        today_daily = {
            "date": str(today),
            "players": int(r.players or 0),
            "solved": int(r.solved or 0),
            "avg_guesses": round(float(r.avg_guesses), 1) if r.avg_guesses is not None else None,
            "fastest_seconds": int(r.fastest) if r.fastest is not None else None,
        }

    # ── Games finished in the last 24 h ──────────────────────────────────
    games_24h = (
        await db.execute(
            select(func.count()).select_from(Game).where(
                Game.status.in_(("won", "lost")),
                Game.completed_at >= utc_now - timedelta(hours=24),
            )
        )
    ).scalar_one()

    # ── Hardest / easiest word played this week (excluding today's daily) ─
    # Difficulty comes from the per-game snapshot (Game.word_difficulty), the
    # same number the review page shows, so the ticker and the review agree.
    exclude = {daily_row.upper()} if daily_row else set()
    word_rows = (
        await db.execute(
            select(
                Game.target_word.label("word"),
                func.count().label("plays"),
                func.avg(Game.word_difficulty).label("difficulty"),
                func.sum(case((Game.status == "won", 1), else_=0)).label("solved"),
            )
            .where(Game.status.in_(("won", "lost")), Game.completed_at >= week_ago, Game.word_difficulty.is_not(None))
            .group_by(Game.target_word)
        )
    ).all()
    # Prefer words several people met; on a quiet week fall back to any played word.
    if sum(1 for r in word_rows if int(r.plays) >= 2) >= 2:
        word_rows = [r for r in word_rows if int(r.plays) >= 2]
    scored = [
        {
            "word": row.word,
            "difficulty": round(float(row.difficulty)),
            "plays": int(row.plays),
            "solve_rate": round(100 * int(row.solved or 0) / int(row.plays)),
        }
        for row in word_rows
        if row.word not in exclude
    ]
    scored.sort(key=lambda w: w["difficulty"], reverse=True)
    hardest = scored[0] if scored else None
    easiest = scored[-1] if len(scored) > 1 else None

    # ── Season: leader and days left ─────────────────────────────────────
    start = datetime(utc_now.year, utc_now.month, 1, tzinfo=UTC)
    days_in_month = calendar.monthrange(utc_now.year, utc_now.month)[1]
    end = start + timedelta(days=days_in_month)
    gain_q = (
        select(EloHistory.user_id, func.sum(EloHistory.delta).label("gain"))
        .where(EloHistory.recorded_at >= start, EloHistory.recorded_at < end)
        .group_by(EloHistory.user_id)
        .subquery()
    )
    leader_row = (
        await db.execute(
            select(User.username, gain_q.c.gain, User.elo_rating)
            .join(gain_q, gain_q.c.user_id == User.id)
            .where(User.is_banned.is_(False), User.is_admin.is_(False), User.profile_public.is_(True))
            .order_by(gain_q.c.gain.desc())
            .limit(1)
        )
    ).first()
    season = {
        "name": start.strftime("%B %Y"),
        "days_left": max(0, (end - utc_now).days),
        "leader": (
            {"username": leader_row.username, "gain": int(leader_row.gain or 0), "rating": round(float(leader_row.elo_rating))}
            if leader_row and (leader_row.gain or 0) > 0
            else None
        ),
    }

    # ── Players total ────────────────────────────────────────────────────
    players_total = (
        await db.execute(select(func.count()).select_from(User).where(User.is_banned.is_(False), User.is_admin.is_(False)))
    ).scalar_one()

    # ── Community: what people did lately (public profiles only) ─────────
    public_user = (User.is_banned.is_(False), User.is_admin.is_(False), User.profile_public.is_(True))
    day_ago = utc_now - timedelta(hours=24)

    ach_count = (
        await db.execute(select(func.count()).select_from(Achievement).where(Achievement.unlocked_at >= day_ago))
    ).scalar_one()
    latest_ach = (
        await db.execute(
            select(User.username, Achievement.achievement_type)
            .select_from(Achievement)
            .join(User, User.id == Achievement.user_id)
            .where(Achievement.unlocked_at >= day_ago, *public_user)
            .order_by(Achievement.unlocked_at.desc())
            .limit(1)
        )
    ).first()

    streak_row = (
        await db.execute(
            select(User.username, User.current_streak).where(User.current_streak >= 2, *public_user).order_by(User.current_streak.desc()).limit(1)
        )
    ).first()

    jump_row = (
        await db.execute(
            select(User.username, Game.elo_delta, Game.num_guesses, Game.word_difficulty)
            .select_from(Game)
            .join(User, User.id == Game.user_id)
            .where(Game.status == "won", Game.rated.is_(True), Game.completed_at >= day_ago, Game.elo_delta.is_not(None), *public_user)
            .order_by(Game.elo_delta.desc())
            .limit(1)
        )
    ).first()

    hard_wins = (
        await db.execute(
            select(func.count()).select_from(Game).where(Game.status == "won", Game.hard_mode.is_(True), Game.completed_at >= week_ago)
        )
    ).scalar_one()

    opener_row = (
        await db.execute(
            select(Move.guess_word, func.count().label("n"))
            .select_from(Move)
            .join(Game, Game.id == Move.game_id)
            .where(Move.move_number == 1, Game.completed_at >= day_ago)
            .group_by(Move.guess_word)
            .order_by(func.count().desc())
            .limit(1)
        )
    ).first()

    one_guess = (
        await db.execute(
            select(User.username)
            .select_from(Game)
            .join(User, User.id == Game.user_id)
            .where(Game.status == "won", Game.num_guesses <= 2, Game.completed_at >= day_ago, *public_user)
            .order_by(Game.completed_at.desc())
            .limit(1)
        )
    ).first()

    community = {
        "achievements_24h": int(ach_count or 0),
        "latest_achievement": (
            {"username": latest_ach.username, "name": _ACH_NAME.get(latest_ach.achievement_type, latest_ach.achievement_type.replace("_", " ").title())}
            if latest_ach
            else None
        ),
        "longest_streak": {"username": streak_row.username, "days": int(streak_row.current_streak)} if streak_row else None,
        "biggest_jump_24h": (
            {"username": jump_row.username, "gain": int(round(float(jump_row.elo_delta))), "guesses": int(jump_row.num_guesses),
             "word_difficulty": int(round(float(jump_row.word_difficulty))) if jump_row.word_difficulty is not None else None}
            if jump_row and float(jump_row.elo_delta) > 0
            else None
        ),
        "hard_mode_wins_week": int(hard_wins or 0),
        "popular_opener_24h": {"word": opener_row.guess_word.upper(), "count": int(opener_row.n)} if opener_row else None,
        "two_guess_hero": {"username": one_guess.username} if one_guess else None,
    }

    data = {
        "generated_at": utc_now.isoformat(),
        "community": community,
        "today_daily": today_daily,
        "games_24h": int(games_24h or 0),
        "players_total": int(players_total or 0),
        "hardest_this_week": hardest,
        "easiest_this_week": easiest,
        "season": season,
    }
    _CACHE["at"] = now
    _CACHE["data"] = data
    return data
