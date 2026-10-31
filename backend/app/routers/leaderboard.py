"""Leaderboard router — global rankings and neighbourhood view."""
from datetime import UTC
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import String, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.elo_history import EloHistory
from app.models.game import Game
from app.models.move import Move
from app.models.user import User
from app.services.auth import get_current_user, get_optional_user

router = APIRouter(prefix="/leaderboard", tags=["leaderboard"])


def _user_with_wins_query():
    """Base query: users joined with their 'ELO win' count.

    A win is defined as any rated game where the player gained ELO
    (positive elo_delta), regardless of whether they actually solved
    the word.
    """
    wins_subq = (
        select(
            Game.user_id,
            func.count().label("wins"),
        )
        .where(
            Game.rated == True,  # noqa: E712
            Game.elo_delta.isnot(None),
            Game.elo_delta > 0,
        )
        .group_by(Game.user_id)
        .subquery()
    )
    return (
        select(
            User.id.label("user_id"),
            User.username,
            User.elo_rating,
            User.games_played,
            func.coalesce(wins_subq.c.wins, 0).label("wins"),
        )
        .outerjoin(wins_subq, User.id == wins_subq.c.user_id)
        .where(*_ranked_player_filter())
    )


def _ranked_player_filter():
    """Who appears on the ladder: players with ≥1 rated game who are neither
    suspended nor admins (admins can see future words, so they don't compete)."""
    return (User.games_played > 0, User.is_banned.is_(False), User.is_admin.is_(False))


def _row_to_entry(row, rank: int) -> dict:
    return {
        "rank": rank,
        "user_id": str(row.user_id),
        "username": row.username,
        "elo_rating": row.elo_rating,
        "games_played": row.games_played,
        "wins": row.wins,
    }


@router.get("/")
async def global_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=50, ge=1, le=100),
) -> list:
    """Return paginated global rankings ordered by ELO descending."""
    offset = (page - 1) * per_page

    q = (
        _user_with_wins_query()
        .order_by(User.elo_rating.desc(), func.cast(User.id, String).asc())
        .offset(offset)
        .limit(per_page)
    )
    result = await db.execute(q)
    rows = result.all()

    return [_row_to_entry(row, offset + idx + 1) for idx, row in enumerate(rows)]


@router.get("/near-me")
async def near_me(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list:
    """Return 5 players above, the current user, and 5 below."""
    # Ties are broken by user id so neighbours with the same rating still
    # show up (strict </> used to make them vanish from the list).
    me_key = (current_user.elo_rating, str(current_user.id))

    above_q = (
        _user_with_wins_query()
        .where(
            User.id != current_user.id,
            (User.elo_rating > current_user.elo_rating)
            | ((User.elo_rating == current_user.elo_rating) & (func.cast(User.id, String) < me_key[1])),
        )
        .order_by(User.elo_rating.asc(), func.cast(User.id, String).desc())
        .limit(5)
    )
    above_rows = list((await db.execute(above_q)).all())
    above_rows.reverse()

    below_q = (
        _user_with_wins_query()
        .where(
            User.id != current_user.id,
            (User.elo_rating < current_user.elo_rating)
            | ((User.elo_rating == current_user.elo_rating) & (func.cast(User.id, String) > me_key[1])),
        )
        .order_by(User.elo_rating.desc(), func.cast(User.id, String).asc())
        .limit(5)
    )
    below_rows = list((await db.execute(below_q)).all())

    rank_result = await db.execute(
        select(func.count())
        .select_from(User)
        .where(
            *_ranked_player_filter(),
            User.id != current_user.id,
            (User.elo_rating > current_user.elo_rating)
            | ((User.elo_rating == current_user.elo_rating) & (func.cast(User.id, String) < me_key[1])),
        )
    )
    my_rank = (rank_result.scalar_one() or 0) + 1

    # Current user's wins (positive ELO delta = win)
    wins_result = await db.execute(
        select(func.count())
        .select_from(Game)
        .where(
            Game.user_id == current_user.id,
            Game.rated == True,  # noqa: E712
            Game.elo_delta.isnot(None),
            Game.elo_delta > 0,
        )
    )
    my_wins = wins_result.scalar_one() or 0

    entries = []
    for i, row in enumerate(above_rows):
        entries.append(_row_to_entry(row, my_rank - len(above_rows) + i))

    entries.append({
        "rank": my_rank,
        "user_id": str(current_user.id),
        "username": current_user.username,
        "elo_rating": current_user.elo_rating,
        "games_played": current_user.games_played,
        "wins": my_wins,
    })

    for i, row in enumerate(below_rows):
        entries.append(_row_to_entry(row, my_rank + i + 1))

    return entries


@router.get("/openers")
async def opener_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    limit: int = Query(default=20, ge=1, le=100),
) -> dict:
    """Most-played opening words across all completed games.

    Returns popularity, solve rate, and average win-length so players can
    benchmark their own opener choice against what the community uses.
    """
    total_q = await db.execute(
        select(func.count(func.distinct(Game.id)))
        .select_from(Game)
        .join(Move, Move.game_id == Game.id)
        .where(Game.status.in_(("won", "lost")))
    )
    total = int(total_q.scalar_one() or 0)
    if total == 0:
        return {"total_games": 0, "openers": []}

    rows_q = (
        select(
            func.upper(Move.guess_word).label("opener"),
            func.count(func.distinct(Game.id)).label("plays"),
            func.sum(case((Game.status == "won", 1), else_=0)).label("wins"),
            func.avg(
                case((Game.status == "won", Game.num_guesses), else_=None)
            ).label("avg_guesses_win"),
        )
        .select_from(Game)
        .join(Move, Move.game_id == Game.id)
        .where(
            Game.status.in_(("won", "lost")),
            Move.move_number == 1,
        )
        .group_by(func.upper(Move.guess_word))
        .order_by(func.count(func.distinct(Game.id)).desc())
        .limit(limit)
    )
    result = await db.execute(rows_q)

    openers = []
    for rank, row in enumerate(result.all(), 1):
        plays = int(row.plays)
        wins = int(row.wins or 0)
        avg = float(row.avg_guesses_win) if row.avg_guesses_win is not None else None
        openers.append({
            "rank": rank,
            "opener": row.opener,
            "plays": plays,
            "wins": wins,
            "solve_rate": round(wins / plays * 100, 1) if plays else 0.0,
            "avg_guesses_win": round(avg, 2) if avg is not None else None,
            "popularity_pct": round(plays / total * 100, 1),
        })
    return {"total_games": total, "openers": openers}


# ---------------------------------------------------------------------------
# Seasons (2.0) — one season per calendar month, ranked by ELO gained
# ---------------------------------------------------------------------------

@router.get("/season")
async def season_leaderboard(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_user)],
    year: int | None = Query(default=None, ge=2024, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    limit: int = Query(default=50, ge=1, le=100),
) -> dict:
    """Monthly season standings.

    Ranked by net ELO gained from rated games in the month (ties: more wins,
    then higher current rating). Nobody's lifetime rating is reset — a
    season is a fresh race layered on top of the permanent ladder, so a
    new player can top the month without a thousand-game history.
    """
    import calendar
    from datetime import datetime

    now = datetime.now(UTC)
    y = year or now.year
    m = month or now.month
    start = datetime(y, m, 1, tzinfo=UTC)
    end = datetime(y + (m // 12), (m % 12) + 1, 1, tzinfo=UTC)
    is_current = start <= now < end

    season_q = (
        select(
            EloHistory.user_id,
            func.sum(EloHistory.delta).label("elo_gain"),
            func.count().label("games"),
            func.sum(case((EloHistory.delta > 0, 1), else_=0)).label("wins"),
            func.max(EloHistory.elo_after).label("peak_elo"),
            func.avg(EloHistory.accuracy_score).label("avg_accuracy"),
        )
        .where(EloHistory.recorded_at >= start, EloHistory.recorded_at < end)
        .group_by(EloHistory.user_id)
        .subquery()
    )
    base = (
        select(
            User.id.label("user_id"),
            User.username,
            User.elo_rating,
            season_q.c.elo_gain,
            season_q.c.games,
            season_q.c.wins,
            season_q.c.peak_elo,
            season_q.c.avg_accuracy,
        )
        .join(season_q, season_q.c.user_id == User.id)
        .where(User.is_banned.is_(False), User.is_admin.is_(False))
    )
    rows = (
        await db.execute(
            base.order_by(season_q.c.elo_gain.desc(), season_q.c.wins.desc(), User.elo_rating.desc()).limit(limit)
        )
    ).all()

    def entry(row, rank: int | None) -> dict:
        return {
            "rank": rank,
            "user_id": str(row.user_id),
            "username": row.username,
            "elo_rating": row.elo_rating,
            "elo_gain": int(row.elo_gain or 0),
            "games": int(row.games or 0),
            "wins": int(row.wins or 0),
            "peak_elo": float(row.peak_elo) if row.peak_elo is not None else None,
            "avg_accuracy": round(float(row.avg_accuracy), 1) if row.avg_accuracy is not None else None,
        }

    entries = [entry(r, i + 1) for i, r in enumerate(rows)]
    total_players = int(
        (await db.execute(select(func.count()).select_from(base.subquery()))).scalar_one() or 0
    )

    me = None
    if current_user is not None and not current_user.is_admin:
        in_top = next((e for e in entries if e["user_id"] == str(current_user.id)), None)
        if in_top is not None:
            me = in_top
        else:
            mine = (await db.execute(base.where(User.id == current_user.id))).first()
            if mine is not None:
                # Rank = 1 + players with a strictly higher gain.
                standings = base.subquery()
                ahead = (
                    await db.execute(
                        select(func.count()).select_from(standings).where(standings.c.elo_gain > mine.elo_gain)
                    )
                ).scalar_one()
                me = entry(mine, int(ahead or 0) + 1)

    return {
        "season": {
            "name": f"{calendar.month_name[m]} {y}",
            "year": y,
            "month": m,
            "starts_at": start.isoformat(),
            "ends_at": end.isoformat(),
            "is_current": is_current,
            "days_left": max(0, (end - now).days) if is_current else 0,
        },
        "total_players": total_players,
        "entries": entries,
        "me": me,
    }
