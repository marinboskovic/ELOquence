"""Authentication service: password hashing, JWT access tokens, rotating
refresh sessions, password-reset tokens and the current-user dependency.

Token model
-----------
* **Access token** — short-lived JWT (``ACCESS_TOKEN_MINUTES``). Carries
  ``sub`` (user id), ``jti``, ``iat``/``exp``/``iss``, ``type="access"`` and
  ``tv`` (the user's ``token_version``). Bumping ``token_version`` on the
  user row (password change, "log out everywhere", ban) invalidates every
  previously issued access token — no server-side denylist needed.
* **Refresh token** — opaque random string. Only its SHA-256 hash is stored
  (``refresh_sessions``). Each use rotates it; reuse of a rotated token is
  treated as theft and revokes the whole family.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.refresh_session import PasswordResetToken, RefreshSession
from app.models.user import User
from app.services.request_meta import client_ip, user_agent

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
_bearer_scheme = HTTPBearer(auto_error=False)

# A real bcrypt hash of a random string. Verified against when the e-mail
# is unknown so a login attempt costs the same time whether or not the
# account exists (no timing-based user enumeration).
_DUMMY_HASH = _pwd_context.hash(secrets.token_hex(16))


def _now() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

async def hash_password(password: str) -> str:
    """Return a bcrypt hash of *password* (offloaded to thread pool)."""
    return await asyncio.to_thread(_pwd_context.hash, password)


async def verify_password(plain: str, hashed: str | None) -> bool:
    """Constant-cost password check. ``hashed=None`` still runs bcrypt."""
    ok = await asyncio.to_thread(_pwd_context.verify, plain, hashed or _DUMMY_HASH)
    return bool(ok) and hashed is not None


def normalize_email(email: str) -> str:
    return email.strip().lower()


# ---------------------------------------------------------------------------
# Access tokens (JWT)
# ---------------------------------------------------------------------------

def create_access_token(user: User, *, minutes: int | None = None) -> str:
    """Create a signed, short-lived JWT for *user*."""
    now = _now()
    payload = {
        "sub": str(user.id),
        "jti": uuid.uuid4().hex,
        "iat": now,
        "exp": now + timedelta(minutes=minutes or settings.ACCESS_TOKEN_MINUTES),
        "iss": settings.JWT_ISSUER,
        "type": "access",
        "tv": int(user.token_version or 0),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode + validate a JWT. Raises ``jwt.PyJWTError`` on any problem."""
    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],
        issuer=settings.JWT_ISSUER,
        options={"require": ["sub", "exp", "iat"]},
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload


def _credentials_error(detail: str = "Could not validate credentials.", code: str = "invalid_token") -> HTTPException:
    """401 with a machine-readable ``X-Error-Code`` header.

    ``detail`` stays a plain string because every client surface renders it
    directly; the code header lets the frontend decide whether a silent
    token refresh is worth attempting (``token_expired``) or not.
    """
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer", "X-Error-Code": code},
    )


def _check_account_state(user: User) -> None:
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been suspended.",
            headers={"X-Error-Code": "banned"},
        )


async def _load_user_from_token(token: str, db: AsyncSession) -> User:
    try:
        payload = decode_access_token(token)
        user_id = uuid.UUID(str(payload.get("sub")))
    except jwt.ExpiredSignatureError:
        raise _credentials_error("Access token expired.", "token_expired")
    except (jwt.PyJWTError, ValueError):
        raise _credentials_error()

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise _credentials_error()
    if int(payload.get("tv", 0)) != int(user.token_version or 0):
        raise _credentials_error("Session was revoked.", "token_revoked")
    _check_account_state(user)
    return user


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """FastAPI dependency — decode the Bearer JWT and return the User row."""
    if credentials is None or not credentials.credentials:
        raise _credentials_error("Not authenticated.", "not_authenticated")
    return await _load_user_from_token(credentials.credentials, db)


async def get_optional_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User | None:
    """Like ``get_current_user`` but returns ``None`` for anonymous callers.

    An *invalid* token is still rejected — silently downgrading a bad token
    to "guest" would hide client bugs and revoked sessions.
    """
    if credentials is None or not credentials.credentials:
        return None
    return await _load_user_from_token(credentials.credentials, db)


async def require_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required.")
    return current_user


# ---------------------------------------------------------------------------
# Refresh sessions
# ---------------------------------------------------------------------------

def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


async def issue_refresh_session(
    db: AsyncSession,
    user: User,
    request: Request | None,
    *,
    family_id: uuid.UUID | None = None,
) -> str:
    """Create a refresh session row and return the raw (unhashed) token."""
    raw = secrets.token_urlsafe(48)
    session = RefreshSession(
        id=uuid.uuid4(),
        user_id=user.id,
        family_id=family_id or uuid.uuid4(),
        token_hash=_hash_token(raw),
        user_agent=user_agent(request) if request else None,
        ip_address=client_ip(request) if request else None,
        created_at=_now(),
        last_used_at=_now(),
        expires_at=_now() + timedelta(days=settings.REFRESH_TOKEN_DAYS),
    )
    db.add(session)
    await db.flush()
    return raw


async def rotate_refresh_session(
    db: AsyncSession, raw_token: str, request: Request | None
) -> tuple[User, str]:
    """Validate *raw_token*, revoke it and return ``(user, new_raw_token)``.

    Reuse of a token that was already rotated means two parties hold the
    same credential — the legitimate client and whoever copied it — so the
    entire family is revoked and both must sign in again.
    """
    token_hash = _hash_token(raw_token)
    session = (
        await db.execute(
            select(RefreshSession).where(RefreshSession.token_hash == token_hash).with_for_update()
        )
    ).scalar_one_or_none()
    if session is None:
        raise _credentials_error("Invalid refresh token.", "invalid_refresh")

    now = _now()
    if session.revoked_at is not None:
        await db.execute(
            update(RefreshSession)
            .where(RefreshSession.family_id == session.family_id, RefreshSession.revoked_at.is_(None))
            .values(revoked_at=now)
        )
        # The request fails with 401, which would roll the session back —
        # commit the family revocation explicitly so it sticks.
        await db.commit()
        raise _credentials_error("Refresh token reuse detected; please sign in again.", "refresh_reused")
    if session.expires_at <= now:
        session.revoked_at = now
        await db.commit()
        raise _credentials_error("Refresh token expired.", "refresh_expired")

    user = (await db.execute(select(User).where(User.id == session.user_id))).scalar_one_or_none()
    if user is None:
        raise _credentials_error()
    _check_account_state(user)

    new_raw = secrets.token_urlsafe(48)
    replacement = RefreshSession(
        id=uuid.uuid4(),
        user_id=user.id,
        family_id=session.family_id,
        token_hash=_hash_token(new_raw),
        user_agent=user_agent(request) if request else session.user_agent,
        ip_address=client_ip(request) if request else session.ip_address,
        created_at=now,
        last_used_at=now,
        expires_at=now + timedelta(days=settings.REFRESH_TOKEN_DAYS),
    )
    session.revoked_at = now
    session.replaced_by = replacement.id
    db.add(replacement)
    await db.flush()
    return user, new_raw


async def revoke_refresh_token(db: AsyncSession, raw_token: str, user: User | None = None) -> bool:
    """Revoke the family that *raw_token* belongs to (logout)."""
    session = (
        await db.execute(select(RefreshSession).where(RefreshSession.token_hash == _hash_token(raw_token)))
    ).scalar_one_or_none()
    if session is None or (user is not None and session.user_id != user.id):
        return False
    await db.execute(
        update(RefreshSession)
        .where(RefreshSession.family_id == session.family_id, RefreshSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    return True


async def revoke_all_sessions(db: AsyncSession, user: User, *, bump_version: bool = True) -> int:
    """Log the user out everywhere. Returns the number of sessions revoked."""
    result = await db.execute(
        update(RefreshSession)
        .where(RefreshSession.user_id == user.id, RefreshSession.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
    if bump_version:
        user.token_version = int(user.token_version or 0) + 1
    return int(result.rowcount or 0)


async def list_active_sessions(db: AsyncSession, user: User) -> list[RefreshSession]:
    """One entry per active family (the newest token in each chain)."""
    rows = (
        await db.execute(
            select(RefreshSession)
            .where(
                RefreshSession.user_id == user.id,
                RefreshSession.revoked_at.is_(None),
                RefreshSession.expires_at > _now(),
            )
            .order_by(RefreshSession.last_used_at.desc())
        )
    ).scalars().all()
    return list(rows)


async def purge_expired_sessions(db: AsyncSession, older_than_days: int = 7) -> int:
    """Housekeeping: delete sessions that have been expired/revoked for a while."""
    cutoff = _now() - timedelta(days=older_than_days)
    from sqlalchemy import delete, or_

    result = await db.execute(
        delete(RefreshSession).where(
            or_(RefreshSession.expires_at < cutoff, RefreshSession.revoked_at < cutoff)
        )
    )
    return int(result.rowcount or 0)


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------

async def create_password_reset_token(db: AsyncSession, user: User) -> str:
    """Invalidate older reset tokens for the user and create a fresh one."""
    now = _now()
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    raw = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=_hash_token(raw),
            created_at=now,
            expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_MINUTES),
        )
    )
    await db.flush()
    return raw


async def consume_password_reset_token(db: AsyncSession, raw: str) -> User:
    """Return the user for a valid, unused, unexpired token and mark it used."""
    row = (
        await db.execute(
            select(PasswordResetToken)
            .where(PasswordResetToken.token_hash == _hash_token(raw))
            .with_for_update()
        )
    ).scalar_one_or_none()
    now = _now()
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired.",
        )
    row.used_at = now
    user = (await db.execute(select(User).where(User.id == row.user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This reset link is invalid.")
    return user


async def find_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Case-insensitive e-mail lookup (legacy rows may still be mixed-case)."""
    normalized = normalize_email(email)
    return (
        await db.execute(
            select(User).where(func.lower(User.email) == normalized).order_by(User.created_at.asc())
        )
    ).scalars().first()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
