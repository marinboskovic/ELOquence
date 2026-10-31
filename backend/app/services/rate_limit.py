"""In-memory sliding-window rate limiter + FastAPI dependency factory.

State lives in process memory and resets on restart — fine for the
single-machine deployment this project runs on. The ``check_rate_limit``
signature maps directly onto a Redis ``ZADD``/``ZREMRANGEBYSCORE`` pattern
if the app ever grows past one instance.

Usage in a router::

    from app.services.rate_limit import rate_limited

    @router.post("/register", dependencies=[rate_limited("register", 5, 3600)])
    async def register(...): ...

    @router.post("/ai/chat", dependencies=[rate_limited("ai-chat", 30, 86400, key="user")])
    async def chat(current_user=Depends(get_current_user), ...): ...

``key="ip"`` buckets by client IP (see ``services.request_meta.client_ip``);
``key="user"`` buckets by the authenticated user id and therefore requires
a valid bearer token.
"""
from collections import deque
from time import monotonic
from typing import Annotated, Literal, Optional

from fastapi import Depends, HTTPException, Request, status

from app.models.user import User
from app.services.auth import get_current_user
from app.services.request_meta import client_ip

_buckets: dict[str, deque[float]] = {}
# Sweep stale buckets occasionally so spoofed keys can't grow memory forever.
_SWEEP_EVERY = 5000
_calls_since_sweep = 0


def _sweep(now: float, max_window: float = 86400.0) -> None:
    stale = [k for k, b in _buckets.items() if not b or b[-1] < now - max_window]
    for k in stale:
        _buckets.pop(k, None)


def check_rate_limit(key: str, max_attempts: int, window_seconds: float) -> Optional[float]:
    """Record an attempt against *key* and return ``None`` if allowed.

    Returns the number of seconds until the next allowed attempt when the
    caller has exceeded ``max_attempts`` within the trailing window. Blocked
    attempts are NOT recorded, so hammering a locked bucket doesn't extend
    the cooldown.
    """
    global _calls_since_sweep
    now = monotonic()
    _calls_since_sweep += 1
    if _calls_since_sweep >= _SWEEP_EVERY:
        _calls_since_sweep = 0
        _sweep(now)

    bucket = _buckets.setdefault(key, deque())
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()

    if len(bucket) >= max_attempts:
        return max(0.1, (bucket[0] + window_seconds) - now)

    bucket.append(now)
    return None


def reset_bucket(key: str) -> None:
    """Forget all recent attempts for *key* (e.g. after a successful login)."""
    _buckets.pop(key, None)


def reset_all() -> None:
    """Test helper."""
    _buckets.clear()


def too_many(retry_after: float, detail: str = "Too many requests. Please slow down.") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=detail,
        headers={"Retry-After": str(int(retry_after) + 1)},
    )


def rate_limited(
    scope: str,
    max_attempts: int,
    window_seconds: float,
    key: Literal["ip", "user"] = "ip",
    detail: str = "Too many requests. Please slow down.",
):
    """Build a ``Depends`` that enforces a limit for one endpoint."""
    if key == "ip":

        async def _by_ip(request: Request) -> None:
            blocked = check_rate_limit(f"{scope}:ip:{client_ip(request)}", max_attempts, window_seconds)
            if blocked is not None:
                raise too_many(blocked, detail)

        return Depends(_by_ip)

    async def _by_user(current_user: Annotated[User, Depends(get_current_user)]) -> None:
        blocked = check_rate_limit(f"{scope}:user:{current_user.id}", max_attempts, window_seconds)
        if blocked is not None:
            raise too_many(blocked, detail)

    return Depends(_by_user)
