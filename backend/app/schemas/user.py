"""User-related Pydantic schemas."""
import re
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,30}$")

# Tiny denylist of the most common leaked passwords. Not a substitute for
# length, but cheap and it blocks the first things every credential-stuffing
# list tries. (Minimum length is enforced separately.)
_COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890",
    "qwerty123", "qwertyuiop", "iloveyou", "letmein1", "welcome1", "admin123",
    "abc12345", "11111111", "00000000", "trustno1", "sunshine", "princess",
    "football", "baseball", "superman", "eloquence", "wordle123",
}


def validate_username(v: str) -> str:
    v = v.strip()
    if not _USERNAME_RE.fullmatch(v):
        raise ValueError(
            "Username must be 3-30 characters: letters, digits, underscores and hyphens only."
        )
    return v


def validate_new_password(password: str, *, email: str | None = None, username: str | None = None) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")
    if len(password) > 128:
        raise ValueError("Password must be at most 128 characters.")
    lowered = password.lower()
    if lowered in _COMMON_PASSWORDS:
        raise ValueError("That password is too common. Please pick something less guessable.")
    if email and lowered == email.lower():
        raise ValueError("Password must not be your e-mail address.")
    if username and lowered == username.lower():
        raise ValueError("Password must not be your username.")
    return password


class UserCreate(BaseModel):
    """Payload for creating a new account."""

    email: EmailStr
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return validate_username(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        return v.strip().lower()


class UserLogin(BaseModel):
    """Payload for logging in."""

    email: EmailStr
    password: str = Field(max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=20, max_length=200)


class LogoutRequest(BaseModel):
    refresh_token: str | None = Field(default=None, max_length=200)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str | None = Field(default=None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class UpdateProfileRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=30)
    profile_public: bool | None = None

    @field_validator("username")
    @classmethod
    def _username(cls, v: str | None) -> str | None:
        return validate_username(v) if v is not None else None


class UserResponse(BaseModel):
    """Representation of the authenticated user (own profile)."""

    id: uuid.UUID
    email: str
    username: str
    avatar_url: str | None = None
    elo_rating: float
    games_played: int
    is_placement: bool
    is_admin: bool = False
    has_password: bool = True
    profile_public: bool = True
    current_streak: int
    max_streak: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionInfo(BaseModel):
    id: uuid.UUID
    user_agent: str | None = None
    ip_address: str | None = None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    current: bool = False

    model_config = {"from_attributes": True}


class GoogleLogin(BaseModel):
    """Payload for Google OAuth login."""

    credential: str = Field(max_length=4096)


class Token(BaseModel):
    """Token pair returned by every sign-in / refresh."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds until the access token expires
