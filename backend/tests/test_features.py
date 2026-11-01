"""Challenges, Opener Lab, public profiles, seasons, admin tools."""
from __future__ import annotations

from tests.conftest import play_to_lose, play_to_win, target_word_of


async def test_challenge_word_never_leaks_before_you_finish(make_user):
    creator = await make_user("creator")
    player = await make_user("player")
    r = await creator.post("/api/challenges/create")
    assert r.status_code == 201
    code = r.json()["code"]

    # Metadata: no word for anyone, creator flagged
    r = await creator.get(f"/api/challenges/{code}")
    assert r.status_code == 200
    assert "target_word" not in r.json() and "word" not in r.json()
    assert r.json()["is_creator"] is True
    assert r.json()["creator_username"] == "creator"

    # /mine must not reveal the word to the creator (they haven't played)
    r = await creator.get("/api/challenges/mine")
    assert r.json()[0]["target_word"] is None

    # Results before anyone played: no word
    r = await player.get(f"/api/challenges/{code}/results")
    assert r.json()["word"] is None

    # Player starts, word still hidden in /mine and /results
    r = await player.post(f"/api/challenges/{code}/play")
    assert r.status_code == 201, r.text
    game = r.json()
    assert game["target_word"] is None and game["mode"] == "challenge"
    r = await player.get("/api/challenges/mine")
    assert r.json()[0]["target_word"] is None and r.json()[0]["my_status"] == "in_progress"
    r = await player.get(f"/api/challenges/{code}/results")
    assert r.json()["word"] is None

    # Re-posting /play resumes the same attempt
    r = await player.post(f"/api/challenges/{code}/play")
    assert r.status_code == 201 and r.json()["id"] == game["id"]

    final = await play_to_win(player, game["id"])
    assert final["status"] == "won"
    r = await player.get(f"/api/challenges/{code}/results")
    body = r.json()
    assert body["word"] == await target_word_of(game["id"])
    assert body["results"][0]["username"] == "player" and body["results"][0]["rank"] == 1
    assert body["results"][0]["patterns"][-1] == 242

    # The creator still hasn't played → still no word for them
    r = await creator.get(f"/api/challenges/{code}/results")
    assert r.json()["word"] is None
    assert r.json()["results"][0]["patterns"] is None

    # Playing again is refused
    r = await player.post(f"/api/challenges/{code}/play")
    assert r.status_code == 409


async def test_two_challenges_same_word_do_not_merge(make_user, db):
    from sqlalchemy import text

    a = await make_user("chal_a")
    b = await make_user("chal_b")
    code_a = (await a.post("/api/challenges/create")).json()["code"]
    code_b = (await b.post("/api/challenges/create")).json()["code"]
    # Force both challenges onto the same word
    await db.execute(text("UPDATE challenges SET target_word = 'CRANE'"))
    await db.commit()

    p = await make_user("chal_p")
    ga = (await p.post(f"/api/challenges/{code_a}/play")).json()
    await play_to_win(p, ga["id"], filler="AUDIO")
    # Playing challenge B (same word) is a *separate* attempt
    r = await p.post(f"/api/challenges/{code_b}/play")
    assert r.status_code == 201
    ra = (await p.get(f"/api/challenges/{code_a}/results")).json()
    rb = (await p.get(f"/api/challenges/{code_b}/results")).json()
    assert len(ra["results"]) == 1 and ra["results"][0]["status"] == "won"
    assert len(rb["results"]) == 1 and rb["results"][0]["status"] == "in_progress"


async def test_opener_lab(client):
    r = await client.get("/api/analysis/lab/opener/SLATE")
    assert r.status_code == 200
    body = r.json()
    assert body["word"] == "SLATE"
    assert 5.5 < body["entropy"] < 6.2
    assert body["rank"] <= 60
    assert body["total_guesses"] > 10000
    assert body["best_openers"][0]["rank"] == 1
    assert body["best_openers"][0]["entropy"] == body["best_entropy"]
    assert sum(b["count"] for b in body["pattern_buckets"]) <= body["answers_total"]
    assert body["facts"]["unique_letters"] == 5

    r = await client.get("/api/analysis/lab/opener/zzzzz")
    assert r.status_code == 422

    # Position report: SLATE with all-gray leaves a big pool; pattern 242 solves
    r = await client.post("/api/analysis/lab/position", json={"guesses": ["SLATE"], "patterns": [0]})
    assert r.status_code == 200
    pos = r.json()
    assert pos["remaining"] > 100
    assert pos["history"][0]["remaining_before"] == body["answers_total"]
    assert pos["top_picks"] and all(len(p["word"]) == 5 for p in pos["top_picks"])
    r = await client.post("/api/analysis/lab/position", json={"guesses": ["CRANE", "SLATE"], "patterns": [0, 999]})
    assert r.status_code == 422
    r = await client.post("/api/analysis/lab/position", json={"guesses": ["CRANE"], "patterns": [242]})
    assert r.json()["remaining"] == 1 and r.json()["solved"] is True


async def test_public_profile_and_privacy(client, make_user):
    u = await make_user("publicguy")
    g = (await u.post("/api/games/", json={"mode": "practice"})).json()
    await play_to_win(u, g["id"])

    r = await client.get("/api/profiles/PUBLICGUY")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "publicguy"
    assert "email" not in body
    assert body["wins"] == 1 and body["completed"] == 1
    assert body["recent_games"][0]["patterns"][-1] == 242
    assert "target_word" not in body["recent_games"][0]
    assert body["favourite_opener"] == "AUDIO"

    r = await u.patch("/api/users/me", json={"profile_public": False})
    assert r.status_code == 200
    r = await client.get("/api/profiles/publicguy")
    assert r.status_code == 404
    r = await u.get("/api/profiles/publicguy")  # owner still sees it
    assert r.status_code == 200 and r.json()["is_me"] is True
    r = await client.get("/api/profiles/nobody-here")
    assert r.status_code == 404


async def test_season_leaderboard(client, make_user):
    a = await make_user("seasona")
    b = await make_user("seasonb")
    ga = (await a.post("/api/games/", json={"mode": "competitive"})).json()
    await play_to_win(a, ga["id"])
    gb = (await b.post("/api/games/", json={"mode": "competitive"})).json()
    await play_to_lose(b, gb["id"])

    r = await client.get("/api/leaderboard/season")
    assert r.status_code == 200
    body = r.json()
    assert body["season"]["is_current"] is True
    assert body["total_players"] == 2
    assert body["entries"][0]["username"] == "seasona"
    assert body["entries"][0]["elo_gain"] > 0 > body["entries"][1]["elo_gain"]
    assert body["me"] is None

    r = await b.get("/api/leaderboard/season")
    assert r.json()["me"]["username"] == "seasonb" and r.json()["me"]["rank"] == 2

    r = await client.get("/api/leaderboard/season", params={"year": 2020, "month": 1})
    assert r.status_code == 422  # before the app existed
    r = await client.get("/api/leaderboard/season", params={"year": 2025, "month": 1})
    assert r.json()["entries"] == [] and r.json()["season"]["is_current"] is False


async def test_near_me_includes_ties(make_user):
    a = await make_user("tie1")
    b = await make_user("tie2")
    c = await make_user("tie3")
    for u in (a, b, c):
        g = (await u.post("/api/games/", json={"mode": "competitive"})).json()
        await u.delete(f"/api/games/{g['id']}")  # same penalty → same rating
    r = await a.get("/api/leaderboard/near-me")
    names = {e["username"] for e in r.json()}
    assert names == {"tie1", "tie2", "tie3"}
    ranks = sorted(e["rank"] for e in r.json())
    assert ranks == [1, 2, 3]


async def test_admin_daily_word_and_audit(make_user):
    admin = await make_user("admin1", admin=True)
    r = await admin.post("/api/admin/daily-words", json={"word": "crane", "date": "2030-01-01"})
    assert r.status_code == 201, r.text
    first_id = r.json()["id"]
    # Update in place keeps the id (= puzzle number)
    r = await admin.post("/api/admin/daily-words", json={"word": "slate", "date": "2030-01-01", "difficulty": 1234})
    assert r.status_code == 201 and r.json()["id"] == first_id and r.json()["word"] == "slate"
    r = await admin.post("/api/admin/daily-words", json={"word": "zzzzz", "date": "2030-01-02"})
    assert r.status_code == 422
    r = await admin.get("/api/admin/audit-log")
    assert r.status_code == 200
    actions = [e["action"] for e in r.json()["entries"]] if isinstance(r.json(), dict) else [e["action"] for e in r.json()]
    assert "set_daily_word" in actions

    normal = await make_user("normal1")
    r = await normal.get("/api/admin/users")
    assert r.status_code == 403


async def test_ai_endpoints_require_key_and_validate_payload(make_user):
    u = await make_user("aiuser")
    g = (await u.post("/api/games/", json={"mode": "practice"})).json()
    await play_to_win(u, g["id"])
    r = await u.post(f"/api/ai/coach-chat/{g['id']}", json={"message": "x" * 2000, "history": []})
    assert r.status_code == 422  # too long
    r = await u.post(f"/api/ai/coach-chat/{g['id']}", json={"message": "hi", "history": [{"role": "system", "content": "x"}]})
    assert r.status_code == 422  # invalid role
    r = await u.post(f"/api/ai/coach-chat/{g['id']}", json={"message": "hi", "history": []})
    assert r.status_code == 503  # no API key in tests
    r = await u.post("/api/ai/explain-move", json={"game_id": "not-a-uuid", "move_number": 1})
    assert r.status_code == 422


async def test_pulse_is_public_and_never_leaks_words(client, make_user):
    a = await make_user("pulsea")
    g = (await a.post("/api/games/", json={"mode": "competitive"})).json()
    await play_to_win(a, g["id"])

    r = await client.get("/api/pulse/")
    assert r.status_code == 200
    body = r.json()
    assert set(body) >= {"today_daily", "games_24h", "players_total", "hardest_this_week", "season"}
    assert body["games_24h"] >= 1
    assert body["season"]["days_left"] >= 0
    # today's daily is counts only
    if body["today_daily"]:
        assert "word" not in body["today_daily"]
    # cached: a second call is identical
    assert (await client.get("/api/pulse/")).json() == body
