"""FastAPI application entry point."""
from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.config import settings

_log = logging.getLogger(__name__)
_access_log = logging.getLogger("eloquence.access")

APP_VERSION = "2.0.0"


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

# Conservative defaults that match an API + SPA topology. The SPA sets its
# own Content-Security-Policy (see frontend/next.config.js).
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Cache-Control": "no-store",
    # Only meaningful over HTTPS; harmless on plain HTTP.
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Append hardening headers + a request id to every response."""

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        for k, v in _SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        response.headers["X-Request-ID"] = request_id
        if request.url.path != "/health":
            _access_log.info(
                "%s %s -> %s %.0fms rid=%s",
                request.method,
                request.url.path,
                response.status_code,
                (time.perf_counter() - started) * 1000,
                request_id,
            )
        return response


class RequestGuardMiddleware(BaseHTTPMiddleware):
    """Global per-IP request budget + request body size cap.

    Endpoint-specific limits (login, register, AI…) live next to the
    endpoints; this is the coarse backstop so one client can't saturate the
    analysis engine or the database with any endpoint it likes.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        from app.services.rate_limit import check_rate_limit
        from app.services.request_meta import client_ip

        if request.method != "OPTIONS" and request.url.path != "/health":
            blocked = check_rate_limit(
                f"global:{client_ip(request)}", settings.GLOBAL_RATE_LIMIT_PER_MINUTE, 60.0
            )
            if blocked is not None:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please slow down."},
                    headers={"Retry-After": str(int(blocked) + 1)},
                )

        content_length = request.headers.get("content-length")
        if content_length and content_length.isdigit() and int(content_length) > settings.MAX_REQUEST_BODY_BYTES:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": "Request body too large."},
            )
        return await call_next(request)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: validate config, load word lists, build/load the pattern
    matrix, start the in-process scheduler. Shutdown: cancel the scheduler."""
    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    settings.validate_runtime()

    from app.analysis.engine import is_valid_word, load_word_lists, precompute_pattern_matrix

    _log.info("Loading word lists…")
    load_word_lists()
    _log.info("Building / loading pattern matrix…")
    started = time.perf_counter()
    precompute_pattern_matrix()
    _log.info("Pattern matrix ready in %.1fs", time.perf_counter() - started)
    is_valid_word("WARMUP")  # pre-warm the word index

    from app.services.notifications_cron import start_cron_tasks

    cron_tasks = start_cron_tasks()
    _log.info("ELOquence backend %s ready (env=%s).", APP_VERSION, settings.ENV)
    yield

    for task in cron_tasks:
        task.cancel()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Construct and configure the FastAPI application."""
    app = FastAPI(
        title="ELOquence API",
        description="Competitive Wordle platform with information-theory analysis.",
        version=APP_VERSION,
        lifespan=lifespan,
        # Interactive docs are a reconnaissance aid; keep them off in prod.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # Middleware order: outermost first. CORS must wrap everything so even
    # 429/413 responses carry the CORS headers the browser needs.
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RequestGuardMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-Error-Code", "Retry-After"],
        max_age=600,
    )

    @app.exception_handler(Exception)
    async def _unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
        """Never leak stack traces or internal paths to clients."""
        rid = getattr(request.state, "request_id", "-")
        _log.exception("Unhandled exception on %s %s rid=%s", request.method, request.url.path, rid)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error.", "request_id": rid},
        )

    from app.routers.achievements import router as achievements_router
    from app.routers.admin import public_router as announcements_public_router
    from app.routers.admin import router as admin_router
    from app.routers.ai import router as ai_router
    from app.routers.analysis import router as analysis_router
    from app.routers.auth import router as auth_router
    from app.routers.challenges import router as challenges_router
    from app.routers.daily import router as daily_router
    from app.routers.games import router as games_router
    from app.routers.leaderboard import router as leaderboard_router
    from app.routers.learn import router as learn_router
    from app.routers.profiles import router as profiles_router
    from app.routers.push import router as push_router
    from app.routers.users import router as users_router

    for r in (
        auth_router,
        games_router,
        challenges_router,
        analysis_router,
        ai_router,
        daily_router,
        leaderboard_router,
        users_router,
        profiles_router,
        learn_router,
        admin_router,
        achievements_router,
        announcements_public_router,
        push_router,
    ):
        app.include_router(r, prefix="/api")

    @app.get("/health", include_in_schema=False)
    async def health_check() -> dict:
        return {"status": "ok", "version": APP_VERSION}

    return app


app = create_app()
