"""Authentication: token pairs, rotation, revocation, password flows, bans."""
from __future__ import annotations

from sqlalchemy import text

from app.database import AsyncSessionLocal


async def test_register_returns_token_pair_and_me_works(client, make_user):
    u = await make_user("alice")
    me = await u.me()
    assert me["username"] == "alice"
    assert me["email"] == "alice@example.com"
    assert me["has_password"] is True
    assert me["profile_public"] is True
    assert "password" not in me


async def test_register_rejects_weak_and_duplicate(client, make_user):
    r = await client.post("/api/auth/register", json={"email": "x@example.com", "username": "xx_user", "password": "password1"})
    assert r.status_code == 422
    assert "common" in r.json()["detail"]

    await make_user("bob")
    # Same e-mail (different case) and a different username → generic 409
    r = await client.post("/api/auth/register", json={"email": "BOB@example.com", "username": "other", "password": "correct-horse-battery"})
    assert r.status_code == 409
    # Same username different case
    r = await client.post("/api/auth/register", json={"email": "new@example.com", "username": "BoB", "password": "correct-horse-battery"})
    assert r.status_code == 409
    # Bad username chars
    r = await client.post("/api/auth/register", json={"email": "new2@example.com", "username": "bad name!", "password": "correct-horse-battery"})
    assert r.status_code == 422


async def test_login_wrong_password_is_401_and_case_insensitive_email(client, make_user):
    u = await make_user("carol")
    r = await client.post("/api/auth/login", json={"email": "CAROL@example.com", "password": "wrong-password"})
    assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"email": "CAROL@example.com", "password": u.password})
    assert r.status_code == 200
    assert set(r.json()) >= {"access_token", "refresh_token", "expires_in"}


async def test_login_rate_limit_per_email(client, make_user):
    u = await make_user("dave")
    for _ in range(10):
        r = await client.post("/api/auth/login", json={"email": u.email, "password": "nope-nope-nope"})
        assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"email": u.email, "password": "nope-nope-nope"})
    assert r.status_code == 429
    assert "Retry-After" in r.headers


async def test_refresh_rotates_and_detects_reuse(client, make_user):
    u = await make_user("erin")
    old_refresh = u.refresh

    r = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 200
    new_pair = r.json()
    assert new_pair["refresh_token"] != old_refresh

    # New access token works
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_pair['access_token']}"})
    assert r.status_code == 200

    # Replaying the OLD refresh token = theft → whole family revoked
    r = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh})
    assert r.status_code == 401
    assert r.headers.get("X-Error-Code") == "refresh_reused"
    r = await client.post("/api/auth/refresh", json={"refresh_token": new_pair["refresh_token"]})
    assert r.status_code == 401


async def test_logout_all_invalidates_access_tokens(client, make_user):
    u = await make_user("frank")
    r = await client.post("/api/auth/login", json={"email": u.email, "password": u.password})
    second = r.json()

    r = await u.post("/api/auth/logout-all")
    assert r.status_code == 204

    # Both access tokens are dead (token_version bumped) …
    r = await client.get("/api/auth/me", headers=u.headers)
    assert r.status_code == 401
    assert r.headers.get("X-Error-Code") == "token_revoked"
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {second['access_token']}"})
    assert r.status_code == 401
    # … and so are the refresh tokens.
    r = await client.post("/api/auth/refresh", json={"refresh_token": second["refresh_token"]})
    assert r.status_code == 401


async def test_sessions_list_and_revoke_one(client, make_user):
    u = await make_user("gina")
    r = await client.post("/api/auth/login", json={"email": u.email, "password": u.password}, headers={"User-Agent": "PhoneBrowser/1.0"})
    phone = r.json()

    r = await u.get("/api/auth/sessions", params={"current": u.refresh})
    assert r.status_code == 200
    sessions = r.json()
    assert len(sessions) == 2
    current = [s for s in sessions if s["current"]]
    assert len(current) == 1
    other = next(s for s in sessions if not s["current"])
    assert other["user_agent"] == "PhoneBrowser/1.0"

    r = await u.delete(f"/api/auth/sessions/{other['id']}")
    assert r.status_code == 204
    r = await client.post("/api/auth/refresh", json={"refresh_token": phone["refresh_token"]})
    assert r.status_code == 401
    # Our own session still fine
    r = await client.post("/api/auth/refresh", json={"refresh_token": u.refresh})
    assert r.status_code == 200


async def test_change_password_revokes_other_sessions(client, make_user):
    u = await make_user("hank")
    r = await client.post("/api/auth/login", json={"email": u.email, "password": u.password})
    other = r.json()

    r = await u.post("/api/auth/change-password", json={"current_password": "wrong-one-here", "new_password": "a-brand-new-passphrase"})
    assert r.status_code == 400
    r = await u.post("/api/auth/change-password", json={"current_password": u.password, "new_password": "a-brand-new-passphrase"})
    assert r.status_code == 200
    fresh = r.json()

    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {other['access_token']}"})
    assert r.status_code == 401
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {fresh['access_token']}"})
    assert r.status_code == 200
    r = await client.post("/api/auth/login", json={"email": u.email, "password": "a-brand-new-passphrase"})
    assert r.status_code == 200


async def test_forgot_and_reset_password_flow(client, make_user, monkeypatch):
    u = await make_user("ivy")
    sent: list[dict] = []

    async def fake_send(to, subject, text_body, html_body=None):
        sent.append({"to": to, "text": text_body})
        return True

    monkeypatch.setattr("app.routers.auth.send_email", fake_send)

    # Unknown address: same response, no mail
    r = await client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 202
    assert sent == []

    r = await client.post("/api/auth/forgot-password", json={"email": "IVY@example.com"})
    assert r.status_code == 202
    assert len(sent) == 1 and sent[0]["to"] == u.email
    link = next(line for line in sent[0]["text"].splitlines() if "/reset-password?token=" in line)
    token = link.split("token=")[1].strip()

    r = await client.post("/api/auth/reset-password", json={"token": token, "password": "reset-passphrase-99"})
    assert r.status_code == 200
    # Token is single-use
    r = await client.post("/api/auth/reset-password", json={"token": token, "password": "another-passphrase-99"})
    assert r.status_code == 400
    # Old sessions revoked, new password works
    r = await client.get("/api/auth/me", headers=u.headers)
    assert r.status_code == 401
    r = await client.post("/api/auth/login", json={"email": u.email, "password": "reset-passphrase-99"})
    assert r.status_code == 200


async def test_banned_user_is_locked_out_everywhere(client, make_user):
    admin = await make_user("root", admin=True)
    victim = await make_user("mallory")
    vid = (await victim.me())["id"]

    r = await admin.post(f"/api/admin/users/{vid}/ban", json={"reason": "cheating"})
    assert r.status_code == 200, r.text

    r = await client.get("/api/auth/me", headers=victim.headers)
    assert r.status_code in (401, 403)
    r = await client.post("/api/auth/login", json={"email": victim.email, "password": victim.password})
    assert r.status_code == 403
    r = await client.post("/api/auth/refresh", json={"refresh_token": victim.refresh})
    assert r.status_code == 401

    # Not on the leaderboard
    r = await client.get("/api/leaderboard/")
    assert all(e["username"] != "mallory" for e in r.json())

    r = await admin.post(f"/api/admin/users/{vid}/unban")
    assert r.status_code == 200
    r = await client.post("/api/auth/login", json={"email": victim.email, "password": victim.password})
    assert r.status_code == 200


async def test_jwt_is_rejected_when_tampered_or_wrong_type(client, make_user):
    u = await make_user("judy")
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {u.access[:-3]}xyz"})
    assert r.status_code == 401
    r = await client.get("/api/auth/me")
    assert r.status_code == 401
    assert r.headers.get("X-Error-Code") == "not_authenticated"


async def test_security_headers_and_body_limit(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert "X-Request-ID" in r.headers

    big = "x" * (300 * 1024)
    r = await client.post("/api/auth/login", content=big, headers={"Content-Type": "application/json"})
    assert r.status_code == 413


async def test_google_username_sanitised(client):
    """Google display names can contain anything; usernames can't."""
    from app.routers.auth import _resolve_google_user

    async with AsyncSessionLocal() as s:
        user = await _resolve_google_user(s, {"sub": "g-123", "email": "Mila.K@Example.com", "name": "Mila <script> Kovač"})
        await s.commit()
        assert user.email == "mila.k@example.com"
        assert user.username == "Mila_script_Kova"
        # Second account with the same display name gets a suffix
        user2 = await _resolve_google_user(s, {"sub": "g-456", "email": "other@example.com", "name": "Mila <script> Kovač"})
        await s.commit()
        assert user2.username == "Mila_script_Kova1"
        n = (await s.execute(text("SELECT count(*) FROM users"))).scalar_one()
        assert n == 2
