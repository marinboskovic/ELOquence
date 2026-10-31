"""Request metadata helpers shared by auth, rate limiting and auditing."""
from __future__ import annotations

from fastapi import Request

from app.config import settings


def client_ip(request: Request) -> str:
    """Return the best-effort real client IP.

    When ``CLIENT_IP_HEADER`` is configured (``Fly-Client-IP`` on Fly.io)
    that header wins: the platform's edge proxy sets it from the accepted
    TCP connection and overwrites any value the client supplied. We never
    trust ``X-Forwarded-For`` — its left-most entry is attacker-controlled,
    so keying a rate limit on it lets anyone bypass the limit by rotating
    a fake header value.
    """
    header = settings.CLIENT_IP_HEADER
    if header:
        value = request.headers.get(header)
        if value:
            return value.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


def user_agent(request: Request) -> str | None:
    ua = request.headers.get("user-agent")
    return ua[:255] if ua else None
