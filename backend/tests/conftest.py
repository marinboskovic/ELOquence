"""Shared fixtures: a real PostgreSQL database (``DATABASE_URL_TEST``),
the FastAPI app served in-process through httpx, and helpers to create
users and finished games.

Set ``TEST_DATABASE_URL`` to point at a throwaway database; it is migrated
to head once per session and every table is truncated between tests.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent

_TEST_ASYNC_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://eloquence:eloquence_dev@localhost:5432/eloquence_test",
)
_TEST_SYNC_URL = _TEST_ASYNC_URL.replace("postgresql+asyncpg://", "postgresql://")

# Must be set BEFORE app.config / app.database are imported.
os.environ["DATABASE_URL"] = _TEST_ASYNC_URL
os.environ["DATABASE_URL_SYNC"] = _TEST_SYNC_URL
os.environ["ENV"] = "test"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-0123456789"
os.environ["CORS_ORIGINS"] = "http://testserver"
os.environ["ACCESS_TOKEN_MINUTES"] = "30"
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("RESEND_API_KEY", None)
os.environ.pop("VAPID_PUBLIC_KEY", None)
os.environ.pop("VAPID_PRIVATE_KEY", None)

sys.path.insert(0, str(BACKEND_DIR))

import httpx  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.database import AsyncSessionLocal, engine  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _migrated_db():
    """Run alembic to head once, and load the analysis engine."""
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        check=True,
        env={**os.environ},
        capture_output=True,
    )
    from app.analysis.engine import load_word_lists, precompute_pattern_matrix

    load_word_lists()
    precompute_pattern_matrix()
    yield


_TABLES = [
    "moves", "games", "elo_history", "achievements", "challenges", "refresh_sessions",
    "password_reset_tokens", "learn_progress", "push_subscriptions", "notification_preferences",
    "player_profiles", "ai_cache", "announcements", "admin_audit_log", "word_stats",
    "daily_words", "users",
]


@pytest.fixture(autouse=True)
async def _clean_db():
    from app.services import rate_limit

    rate_limit.reset_all()
    yield
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE " + ", ".join(_TABLES) + " RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c


@pytest.fixture
async def db():
    async with AsyncSessionLocal() as session:
        yield session
        await session.commit()


class UserHandle:
    def __init__(self, client: httpx.AsyncClient, data: dict, tokens: dict):
        self.client = client
        self.email = data["email"]
        self.username = data["username"]
        self.password = data["password"]
        self.access = tokens["access_token"]
        self.refresh = tokens["refresh_token"]

    @property
    def headers(self) -> dict:
        return {"Authorization": f"Bearer {self.access}"}

    async def get(self, url, **kw):
        return await self.client.get(url, headers=self.headers, **kw)

    async def post(self, url, **kw):
        return await self.client.post(url, headers=self.headers, **kw)

    async def patch(self, url, **kw):
        return await self.client.patch(url, headers=self.headers, **kw)

    async def delete(self, url, **kw):
        return await self.client.delete(url, headers=self.headers, **kw)

    async def me(self) -> dict:
        r = await self.get("/api/auth/me")
        assert r.status_code == 200, r.text
        return r.json()


@pytest.fixture
def make_user(client):
    counter = {"n": 0}

    async def _make(username: str | None = None, *, admin: bool = False) -> UserHandle:
        counter["n"] += 1
        name = username or f"player{counter['n']}"
        data = {"email": f"{name}@example.com", "username": name, "password": "correct-horse-battery"}
        r = await client.post("/api/auth/register", json=data)
        assert r.status_code == 201, r.text
        handle = UserHandle(client, data, r.json())
        if admin:
            async with AsyncSessionLocal() as s:
                await s.execute(text("UPDATE users SET is_admin = true WHERE username = :u"), {"u": name})
                await s.commit()
        return handle

    return _make


async def target_word_of(game_id: str) -> str:
    async with AsyncSessionLocal() as s:
        row = await s.execute(text("SELECT target_word FROM games WHERE id = :id"), {"id": game_id})
        return row.scalar_one()


async def play_to_win(user: UserHandle, game_id: str, *, filler: str = "AUDIO") -> dict:
    """Guess one filler word, then the answer."""
    word = await target_word_of(game_id)
    if filler != word:
        r = await user.post(f"/api/games/{game_id}/guess", json={"guess": filler})
        assert r.status_code == 200, r.text
    r = await user.post(f"/api/games/{game_id}/guess", json={"guess": word})
    assert r.status_code == 200, r.text
    return r.json()


async def play_to_lose(user: UserHandle, game_id: str) -> dict:
    word = await target_word_of(game_id)
    fillers = ["AUDIO", "STERN", "CHUMP", "FLACK", "GAWKY", "BIBLE", "DIZZY"]
    last = None
    for f in fillers:
        if f == word:
            continue
        last = await user.post(f"/api/games/{game_id}/guess", json={"guess": f})
        assert last.status_code == 200, last.text
        if last.json()["status"] != "in_progress":
            break
    return last.json()
