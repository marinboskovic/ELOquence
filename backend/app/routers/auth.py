"""Authentication router — register, login, refresh, logout, Google OAuth,
password reset/change, session management."""
from __future__ import annotations

import logging
import re
import uuid
from datetime import UTC, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    GoogleLogin,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    SessionInfo,
    Token,
    UserCreate,
    UserLogin,
    UserResponse,
    validate_new_password,
)
from app.services.auth import (
    consume_password_reset_token,
    create_access_token,
    create_password_reset_token,
    find_user_by_email,
    get_current_user,
    hash_password,
    issue_refresh_session,
    list_active_sessions,
    normalize_email,
    revoke_all_sessions,
    revoke_refresh_token,
    rotate_refresh_session,
    verify_password,
)
from app.services.mailer import password_reset_message, send_email
from app.services.rate_limit import check_rate_limit, rate_limited, reset_bucket, too_many
from app.services.request_meta import client_ip

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

_log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

async def _token_pair(db: AsyncSession, user: User, request: Request | None) -> Token:
    """Issue a fresh access + refresh token pair for *user*."""
    refresh = await issue_refresh_session(db, user, request)
    return Token(
        access_token=create_access_token(user),
        refresh_token=refresh,
        expires_in=settings.ACCESS_TOKEN_MINUTES * 60,
    )


def _verify_google_idinfo(google_id_token: str) -> dict:
    """Verify a Google id_token JWT and return its claims.

    The audience MUST match our GOOGLE_CLIENT_ID and ``email_verified`` MUST
    be true — otherwise an attacker who creates a Google account claiming a
    victim's address could be silently linked to the victim's account.
    """
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured.")
    try:
        idinfo = id_token.verify_oauth2_token(
            google_id_token, google_requests.Request(), settings.GOOGLE_CLIENT_ID
        )
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google credential.")
    if not idinfo.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is not verified.")
    if not idinfo.get("email"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google credential did not include an email address.")
    return idinfo


_USERNAME_CLEAN_RE = re.compile(r"[^A-Za-z0-9_-]+")


async def _unique_username(db: AsyncSession, base: str) -> str:
    """Derive a valid, unused username from a free-form display name."""
    base = _USERNAME_CLEAN_RE.sub("", base.replace(" ", "_"))[:24] or "player"
    if len(base) < 3:
        base = f"{base}_player"[:24]
    candidate = base
    suffix = 0
    while True:
        taken = await db.execute(select(User.id).where(func.lower(User.username) == candidate.lower()))
        if taken.scalar_one_or_none() is None:
            return candidate
        suffix += 1
        candidate = f"{base}{suffix}"


async def _resolve_google_user(db: AsyncSession, idinfo: dict) -> User:
    """Find-or-create-or-link the User row for a verified Google identity."""
    google_id = idinfo["sub"]
    email = normalize_email(idinfo["email"])
    name = idinfo.get("name", "")
    picture = idinfo.get("picture", "")

    user = (await db.execute(select(User).where(User.google_id == google_id))).scalar_one_or_none()
    if user is not None:
        if picture and user.avatar_url != picture:
            user.avatar_url = picture
            await db.flush()
        return user

    # Account-linking path (safe only because email_verified was enforced).
    user = await find_user_by_email(db, email)
    if user is not None:
        user.google_id = google_id
        if picture:
            user.avatar_url = picture
        await db.flush()
        return user

    username = await _unique_username(db, name or email.split("@")[0])
    user = User(
        id=uuid.uuid4(),
        email=email,
        username=username,
        password_hash=None,
        google_id=google_id,
        avatar_url=picture or None,
    )
    db.add(user)
    await db.flush()
    return user


# ---------------------------------------------------------------------------
# Register / login / refresh / logout
# ---------------------------------------------------------------------------

@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    dependencies=[rate_limited("register", 10, 3600, detail="Too many sign-ups from this address. Try again later.")],
)
async def register(payload: UserCreate, request: Request, db: Annotated[AsyncSession, Depends(get_db)]) -> Token:
    """Create a new user account and return a token pair."""
    try:
        validate_new_password(payload.password, email=payload.email, username=payload.username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))

    # One generic error for both collisions so the endpoint can't be used to
    # enumerate which e-mails / usernames are registered.
    existing = await db.execute(
        select(User.id).where(
            (func.lower(User.email) == payload.email) | (func.lower(User.username) == payload.username.lower())
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Registration failed. Please choose different credentials.",
        )

    user = User(
        id=uuid.uuid4(),
        email=payload.email,
        username=payload.username,
        password_hash=await hash_password(payload.password),
        password_changed_at=datetime.now(UTC),
    )
    db.add(user)
    await db.flush()
    return await _token_pair(db, user, request)


@router.post("/login", response_model=Token)
async def login(payload: UserLogin, request: Request, db: Annotated[AsyncSession, Depends(get_db)]) -> Token:
    """Authenticate with e-mail + password and return a token pair.

    Throttled per target e-mail AND per client IP. A successful login
    clears both buckets. The password check runs bcrypt even when the
    e-mail is unknown, so timing doesn't reveal which accounts exist.
    """
    email = normalize_email(payload.email)
    email_key = f"login:email:{email}"
    ip_key = f"login:ip:{client_ip(request)}"

    blocked = check_rate_limit(email_key, max_attempts=10, window_seconds=300.0)
    if blocked is None:
        blocked = check_rate_limit(ip_key, max_attempts=30, window_seconds=300.0)
    if blocked is not None:
        raise too_many(blocked, "Too many login attempts. Please try again later.")

    user = await find_user_by_email(db, email)
    ok = await verify_password(payload.password, user.password_hash if user else None)
    if user is None or not ok:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been suspended.")

    reset_bucket(email_key)
    reset_bucket(ip_key)
    return await _token_pair(db, user, request)


@router.post("/refresh", response_model=Token, dependencies=[rate_limited("refresh", 60, 60)])
async def refresh(payload: RefreshRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]) -> Token:
    """Exchange a refresh token for a new token pair (rotating the refresh token)."""
    user, new_refresh = await rotate_refresh_session(db, payload.refresh_token, request)
    return Token(
        access_token=create_access_token(user),
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_MINUTES * 60,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def logout(payload: LogoutRequest, db: Annotated[AsyncSession, Depends(get_db)]) -> None:
    """Revoke the given refresh token (this device). Always succeeds."""
    if payload.refresh_token:
        await revoke_refresh_token(db, payload.refresh_token)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def logout_all(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Revoke every session for the current user, including this one."""
    await revoke_all_sessions(db, current_user)


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@router.get("/sessions", response_model=list[SessionInfo])
async def sessions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_refresh: Annotated[str | None, Query(alias="current", max_length=200)] = None,
) -> list[SessionInfo]:
    """List active sign-ins (one per device). Pass ``?current=<refresh
    token>`` to have the caller's own session flagged."""
    from app.services.auth import _hash_token  # noqa: PLC0415

    current_hash = _hash_token(current_refresh) if current_refresh else None
    rows = await list_active_sessions(db, current_user)
    return [
        SessionInfo(
            id=s.id,
            user_agent=s.user_agent,
            ip_address=s.ip_address,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            expires_at=s.expires_at,
            current=(current_hash is not None and s.token_hash == current_hash),
        )
        for s in rows
    ]


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def revoke_session(
    session_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Sign out one device."""
    from sqlalchemy import update

    from app.models.refresh_session import RefreshSession

    target = (
        await db.execute(
            select(RefreshSession).where(RefreshSession.id == session_id, RefreshSession.user_id == current_user.id)
        )
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    await db.execute(
        update(RefreshSession)
        .where(RefreshSession.family_id == target.family_id, RefreshSession.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


# ---------------------------------------------------------------------------
# Password reset / change
# ---------------------------------------------------------------------------

@router.post(
    "/forgot-password",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[rate_limited("forgot-password", 5, 900, detail="Too many reset requests. Try again in a few minutes.")],
)
async def forgot_password(payload: ForgotPasswordRequest, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Send a reset link if the address belongs to a password account.

    The response is identical whether or not the e-mail exists.
    """
    email = normalize_email(payload.email)
    # Per-address throttle on top of the per-IP one: one mail per 2 minutes.
    if check_rate_limit(f"forgot-password:email:{email}", 1, 120) is None:
        user = await find_user_by_email(db, email)
        if user is not None and user.password_hash and not user.is_banned:
            raw = await create_password_reset_token(db, user)
            link = f"{settings.frontend_url}/reset-password?token={raw}"
            subject, text, html_body = password_reset_message(user.username, link)
            await send_email(user.email, subject, text, html_body)
    return {"message": "If an account exists for that e-mail, a reset link has been sent."}


@router.post("/reset-password", dependencies=[rate_limited("reset-password", 10, 900)])
async def reset_password(
    payload: ResetPasswordRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]
) -> Token:
    """Set a new password using a reset token; signs the user in afterwards."""
    user = await consume_password_reset_token(db, payload.token)
    try:
        validate_new_password(payload.password, email=user.email, username=user.username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    user.password_hash = await hash_password(payload.password)
    user.password_changed_at = datetime.now(UTC)
    # Every other session is now untrusted.
    await revoke_all_sessions(db, user)
    return await _token_pair(db, user, request)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Change (or, for Google-only accounts, set) the password.

    Requires the current password when one exists. All other sessions are
    revoked; a fresh token pair is returned for this device.
    """
    if current_user.password_hash:
        if not payload.current_password or not await verify_password(payload.current_password, current_user.password_hash):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect.")
    try:
        validate_new_password(payload.new_password, email=current_user.email, username=current_user.username)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc))
    current_user.password_hash = await hash_password(payload.new_password)
    current_user.password_changed_at = datetime.now(UTC)
    await revoke_all_sessions(db, current_user)
    return await _token_pair(db, current_user, request)


# ---------------------------------------------------------------------------
# Google
# ---------------------------------------------------------------------------

@router.post("/google", response_model=Token, dependencies=[rate_limited("google-login", 30, 300)])
async def google_login(payload: GoogleLogin, request: Request, db: Annotated[AsyncSession, Depends(get_db)]) -> Token:
    """Authenticate via Google Sign-In (id_token credential)."""
    idinfo = _verify_google_idinfo(payload.credential)
    user = await _resolve_google_user(db, idinfo)
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been suspended.")
    return await _token_pair(db, user, request)


@router.get("/google/callback", response_model=Token, dependencies=[rate_limited("google-login", 30, 300)])
async def google_callback(
    code: Annotated[str, Query(max_length=1024)],
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> Token:
    """Authorization-code callback: exchange the code, verify the id_token,
    create/link the user and return a token pair.

    The redirect_uri must match what the frontend sent Google to the byte;
    it is derived from ``FRONTEND_URL`` (first CORS origin by default).
    """
    if not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured.")
    redirect_uri = settings.frontend_url + "/api/auth/callback/google"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            token_resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not reach Google.")

    if token_resp.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to exchange Google authorization code.")

    google_id_token = token_resp.json().get("id_token")
    if not google_id_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing id_token in Google token response.")

    idinfo = _verify_google_idinfo(google_id_token)
    user = await _resolve_google_user(db, idinfo)
    if user.is_banned:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been suspended.")
    return await _token_pair(db, user, request)


# ---------------------------------------------------------------------------
# Me
# ---------------------------------------------------------------------------

@router.get("/me", response_model=UserResponse)
async def me(current_user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    """Return the currently authenticated user's profile."""
    from app.services.elo import effective_streak

    data = UserResponse.model_validate(current_user)
    data.current_streak = effective_streak(current_user)
    return data
