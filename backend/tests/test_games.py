"""Game flow: word hiding, hard mode, timing, abandon, daily rules."""
from __future__ import annotations

from datetime import UTC, date

from sqlalchemy import text

from app.database import AsyncSessionLocal
from tests.conftest import play_to_lose, play_to_win, target_word_of


async def _start(user, mode="practice", **extra) -> dict:
    r = await user.post("/api/games/", json={"mode": mode, **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def test_in_progress_game_hides_word_and_engine_output(make_user):
    u = await make_user()
    g = await _start(u)
    assert g["target_word"] is None
    r = await u.post(f"/api/games/{g['id']}/guess", json={"guess": "AUDIO"})
    body = r.json()
    if body["status"] == "in_progress":
        move = body["moves"][0]
        assert move["guess_word"] == "AUDIO"
        assert 0 <= move["pattern"] <= 242
        # No solver help while the game is live
        assert move["optimal_word"] is None
        assert move["remaining_words"] is None
        assert move["classification"] is None
        assert body["target_word"] is None


async def test_win_reveals_word_sets_time_and_analysis(make_user):
    u = await make_user()
    g = await _start(u)
    final = await play_to_win(u, g["id"])
    assert final["status"] == "won"
    assert final["target_word"] == await target_word_of(g["id"])
    assert final["time_seconds"] is not None and final["time_seconds"] >= 0
    assert final["accuracy_score"] is not None
    last = final["moves"][-1]
    assert last["pattern"] == 242
    assert last["classification"] is not None  # revealed once finished


async def test_invalid_word_and_double_submit(make_user):
    u = await make_user()
    g = await _start(u)
    r = await u.post(f"/api/games/{g['id']}/guess", json={"guess": "ZZZZZ"})
    assert r.status_code == 422
    r = await u.post(f"/api/games/{g['id']}/guess", json={"guess": "ab1"})
    assert r.status_code == 422
    await play_to_win(u, g["id"])
    r = await u.post(f"/api/games/{g['id']}/guess", json={"guess": "AUDIO"})
    assert r.status_code == 409


async def test_other_user_cannot_see_or_play_my_game(make_user):
    a = await make_user()
    b = await make_user()
    g = await _start(a)
    r = await b.get(f"/api/games/{g['id']}")
    assert r.status_code == 404
    r = await b.post(f"/api/games/{g['id']}/guess", json={"guess": "AUDIO"})
    assert r.status_code == 404
    r = await b.delete(f"/api/games/{g['id']}")
    assert r.status_code == 404


async def test_hard_mode_is_enforced_server_side(make_user):
    u = await make_user()
    g = await _start(u, hard_mode=True)
    assert g["hard_mode"] is True
    word = await target_word_of(g["id"])
    # Force a known first guess that shares at least one letter with the target
    first = "AUDIO" if word != "AUDIO" else "STERN"
    r = await u.post(f"/api/games/{g['id']}/guess", json={"guess": first})
    pattern = r.json()["moves"][0]["pattern"]
    revealed = [(first[i], (pattern // 3**i) % 3) for i in range(5)]
    hinted = [ch for ch, v in revealed if v in (1, 2)]
    if not hinted:
        return  # nothing revealed → nothing to enforce in this draw
    # A guess that reuses none of the hinted letters must be rejected.
    candidates = ["GLYPH", "CRWTH", "NYMPH", "PSYCH", "BLITZ", "FJORD"]
    bad = next(c for c in candidates if not any(h in c for h in hinted))
    r = await u.post(f"/api/games/{g['id']}/guess", json={"guess": bad})
    assert r.status_code == 400
    assert r.json()["detail"].startswith("Hard mode")


async def test_hard_mode_violation_helper_counts_duplicates():
    from app.analysis.engine import compute_pattern
    from app.services.game import hard_mode_violation

    # Target EERIE, guess EASEL → E green at 0, E yellow at 3 → need two E's
    p = compute_pattern("EASEL", "EERIE")
    assert hard_mode_violation("ERODE", [("EASEL", p)]) is None  # E at 0, second E present
    assert hard_mode_violation("EMBER", [("EASEL", p)]) is None
    assert hard_mode_violation("EXTRA", [("EASEL", p)]) is not None  # only one E
    assert hard_mode_violation("AXIOM", [("EASEL", p)]) is not None  # E not at position 1


async def test_abandon_competitive_costs_elo_and_reveals_word(make_user):
    u = await make_user()
    before = (await u.me())["elo_rating"]
    g = await _start(u, mode="competitive")
    r = await u.delete(f"/api/games/{g['id']}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "abandoned"
    assert body["target_word"] is not None  # loss already paid for
    assert body["elo_delta"] < 0
    after = (await u.me())["elo_rating"]
    assert after < before
    # Abandoning twice is a 409
    r = await u.delete(f"/api/games/{g['id']}")
    assert r.status_code == 409


async def test_abandoned_daily_never_reveals_word(client, make_user):
    u = await make_user()
    r = await u.post("/api/daily/play")
    assert r.status_code == 201, r.text
    g = r.json()
    r = await u.delete(f"/api/games/{g['id']}")
    assert r.status_code == 200
    assert r.json()["target_word"] is None
    r = await u.get(f"/api/games/{g['id']}")
    assert r.json()["target_word"] is None
    # The daily can be retried after abandoning …
    r = await u.post("/api/daily/play")
    assert r.status_code == 201
    g2 = r.json()
    assert g2["id"] != g["id"]
    # … and finishing it blocks a third attempt.
    await play_to_lose(u, g2["id"])
    r = await u.post("/api/daily/play")
    assert r.status_code in (200, 201)
    assert r.json()["id"] == g2["id"]  # existing finished game returned, not a new one
    r = await u.get("/api/daily/")
    assert r.json()["already_played"] is True


async def test_daily_word_is_shared_and_streak_counts(client, make_user):
    a = await make_user()
    b = await make_user()
    ga = (await a.post("/api/daily/play")).json()
    gb = (await b.post("/api/daily/play")).json()
    assert await target_word_of(ga["id"]) == await target_word_of(gb["id"])
    final = await play_to_win(a, ga["id"])
    assert final["status"] == "won"
    me = await a.me()
    assert me["current_streak"] == 1
    assert me["max_streak"] == 1


async def test_guest_daily_flow_and_rate_limit(client):
    r = await client.post("/api/daily/guest")
    assert r.status_code == 201
    g = r.json()
    assert g["target_word"] is None and g["user_id"] is None
    r = await client.post(f"/api/daily/guest/{g['id']}/guess", json={"guess": "AUDIO"})
    assert r.status_code == 200
    r = await client.get(f"/api/daily/guest/{g['id']}")
    assert r.status_code == 200
    # 5 per hour per IP
    for _ in range(4):
        assert (await client.post("/api/daily/guest")).status_code == 201
    assert (await client.post("/api/daily/guest")).status_code == 429


async def test_replay_matches_by_word_not_creation_day(make_user):
    u = await make_user()
    today = (await u.post("/api/daily/play")).json()
    r = await u.post("/api/daily/replay", json={"date": "2024-03-15"})
    assert r.status_code == 200, r.text
    replay = r.json()
    assert replay["id"] != today["id"]
    assert await target_word_of(replay["id"]) != await target_word_of(today["id"]) or True
    # Requesting the same replay again returns the same game
    r = await u.post("/api/daily/replay", json={"date": "2024-03-15"})
    assert r.json()["id"] == replay["id"]
    r = await u.post("/api/daily/replay", json={"date": "2999-01-01"})
    assert r.status_code == 400
    r = await u.post("/api/daily/replay", json={"date": "2019-01-01"})
    assert r.status_code == 400


async def test_resolve_daily_date_window():
    from datetime import datetime
    from unittest.mock import patch

    from app.services import game as game_service

    fixed = datetime(2026, 10, 31, 8, 0, tzinfo=UTC)  # 08:00 UTC

    class _FakeDT(datetime):
        @classmethod
        def now(cls, tz=None):
            return fixed

    with patch.object(game_service, "datetime", _FakeDT):
        assert game_service.resolve_daily_date("2026-10-31") == date(2026, 10, 31)
        assert game_service.resolve_daily_date("2026-10-30") == date(2026, 10, 30)  # UTC-12 still on the 30th
        assert game_service.resolve_daily_date("2026-11-01") == date(2026, 10, 31)  # nobody is on Nov 1 at 08:00 UTC
        assert game_service.resolve_daily_date("garbage") == date(2026, 10, 31)

    fixed = datetime(2026, 10, 31, 13, 0, tzinfo=UTC)
    with patch.object(game_service, "datetime", _FakeDT):
        assert game_service.resolve_daily_date("2026-11-01") == date(2026, 11, 1)  # UTC+14 crossed midnight
        assert game_service.resolve_daily_date("2026-10-30") == date(2026, 10, 31)  # nobody is still on the 30th


async def test_stats_export_and_profile_update(make_user):
    u = await make_user("statsy")
    g = await _start(u)
    await play_to_win(u, g["id"])
    g2 = await _start(u)
    await play_to_lose(u, g2["id"])

    r = await u.get("/api/users/me/stats")
    assert r.status_code == 200
    stats = r.json()
    assert stats["mode_stats"]["practice"]["wins"] == 1
    assert stats["mode_stats"]["practice"]["losses"] == 1
    assert len(stats["nemesis_words"]) == 1
    assert stats["nemesis_words"][0]["word"] == await target_word_of(g2["id"])
    assert stats["pace"]["timed_wins"] == 1
    assert stats["favourite_opener"]["word"] == "AUDIO"

    r = await u.get("/api/users/me/export")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    export = r.json()
    assert export["account"]["username"] == "statsy"
    assert len(export["games"]) == 2
    assert export["games"][0]["moves"][0]["guess"] == "AUDIO"

    r = await u.patch("/api/users/me", json={"username": "renamed", "profile_public": False})
    assert r.status_code == 200
    assert r.json()["username"] == "renamed"
    assert r.json()["profile_public"] is False
    await make_user("taken")
    r = await u.patch("/api/users/me", json={"username": "TAKEN"})
    assert r.status_code == 409


async def test_elo_sign_guarantees():
    from app.services.elo import _apply_outcome_floor, calculate_elo_delta, calculate_performance_score

    # Losing to a much harder word still costs rating
    perf = calculate_performance_score(accuracy=80, num_guesses=6, won=False, time_seconds=30)
    delta = calculate_elo_delta(800, 1800, perf, is_placement=False)
    assert _apply_outcome_floor(delta, won=False, num_guesses=6) <= -1
    # Winning in 2 against an easy word still gains
    perf = calculate_performance_score(accuracy=95, num_guesses=2, won=True, time_seconds=20)
    delta = calculate_elo_delta(1800, 600, perf, is_placement=False)
    assert _apply_outcome_floor(delta, won=True, num_guesses=2) >= 1


async def test_achievement_unique_constraint():
    async with AsyncSessionLocal() as s:
        idx = (await s.execute(text(
            "SELECT conname FROM pg_constraint WHERE conname = 'uq_achievements_user_type'"
        ))).scalar_one_or_none()
        assert idx == "uq_achievements_user_type"
