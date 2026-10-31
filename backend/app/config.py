"""Application configuration using pydantic-settings.

Every value can be supplied through the environment (or a ``.env`` file in
the backend directory). ``validate_runtime()`` is called once on startup and
refuses to boot a production deployment with insecure defaults.
"""
from __future__ import annotations

import logging
from typing import Literal

from pydantic_settings import BaseSettings

_log = logging.getLogger(__name__)

_INSECURE_JWT_SECRET = "dev-secret-change-in-production"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # ── Runtime ──────────────────────────────────────────────────────────
    # "production" enables the hard safety checks in validate_runtime().
    ENV: Literal["development", "test", "production"] = "development"
    LOG_LEVEL: str = "INFO"

    # ── Database ─────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://eloquence:eloquence_dev@localhost:5432/eloquence"
    DATABASE_URL_SYNC: str = "postgresql://eloquence:eloquence_dev@localhost:5432/eloquence"

    # ── Auth ─────────────────────────────────────────────────────────────
    JWT_SECRET: str = _INSECURE_JWT_SECRET
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "eloquence"
    # Access tokens are deliberately short-lived; the client silently renews
    # them with a rotating refresh token (see services/auth.py).
    ACCESS_TOKEN_MINUTES: int = 30
    REFRESH_TOKEN_DAYS: int = 30
    PASSWORD_RESET_MINUTES: int = 30

    # ── HTTP ─────────────────────────────────────────────────────────────
    CORS_ORIGINS: str = "http://localhost:3000"
    # Public URL of the frontend, used in e-mails (password reset links).
    # Defaults to the first CORS origin.
    FRONTEND_URL: str = ""
    # Header that carries the *real* client IP when running behind a trusted
    # reverse proxy. On Fly.io set this to "Fly-Client-IP" — Fly's edge sets
    # it and overwrites anything the client sent, unlike X-Forwarded-For
    # whose left-most entry is attacker-controlled. Empty = use the socket
    # peer address.
    CLIENT_IP_HEADER: str = ""
    # Global per-IP request budget (requests per minute). Generous enough for
    # normal play; stops a single client from hammering the analysis engine.
    GLOBAL_RATE_LIMIT_PER_MINUTE: int = 300
    MAX_REQUEST_BODY_BYTES: int = 256 * 1024

    # ── Integrations ─────────────────────────────────────────────────────
    # Gemini powers the AI coach (Tier 1 explain-move, Tier 2 game-summary,
    # Tier 3 coach-chat). Empty key = rule-based commentary only.
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Transactional e-mail (password reset). Empty key = log the message
    # instead of sending it, which is what you want in local development.
    RESEND_API_KEY: str = ""
    EMAIL_FROM: str = "ELOquence <no-reply@eloquence.app>"

    # Web Push VAPID — empty values disable push entirely (graceful no-op).
    # Generate a fresh pair with `python -m app.cli.generate_vapid`.
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:dev@eloquence.local"

    model_config = {"env_file": ".env", "case_sensitive": True, "extra": "ignore"}

    # ── Derived helpers ──────────────────────────────────────────────────
    @property
    def is_production(self) -> bool:
        return self.ENV == "production"

    @property
    def push_enabled(self) -> bool:
        """True when both VAPID keys are configured."""
        return bool(self.VAPID_PUBLIC_KEY and self.VAPID_PRIVATE_KEY)

    @property
    def email_enabled(self) -> bool:
        return bool(self.RESEND_API_KEY)

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def frontend_url(self) -> str:
        if self.FRONTEND_URL:
            return self.FRONTEND_URL.rstrip("/")
        origins = self.cors_origins_list
        return origins[0] if origins else "http://localhost:3000"

    def validate_runtime(self) -> None:
        """Fail fast on configurations that would be dangerous in production.

        Called from the FastAPI lifespan. In development we only warn so a
        fresh checkout still boots; in production a weak secret is a hard
        error — forging an admin JWT with the public default secret would
        otherwise be trivial.
        """
        problems: list[str] = []
        if self.JWT_SECRET == _INSECURE_JWT_SECRET:
            problems.append("JWT_SECRET is the public default value")
        elif len(self.JWT_SECRET) < 32:
            problems.append("JWT_SECRET is shorter than 32 characters")
        if "*" in self.cors_origins_list:
            problems.append("CORS_ORIGINS must not contain '*' (credentials are allowed)")

        if not problems:
            return
        message = "; ".join(problems)
        if self.is_production:
            raise RuntimeError(f"Refusing to start in production: {message}")
        _log.warning("Insecure configuration (ok for development only): %s", message)


settings = Settings()
