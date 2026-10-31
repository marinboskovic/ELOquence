"""Pydantic schemas for the push-notification endpoints."""
from __future__ import annotations

from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

# Hosts browsers actually use for Web Push. The server POSTs to the endpoint
# on demand (``/push/test``), so without an allowlist it is an SSRF primitive.
_PUSH_HOST_SUFFIXES = (
    "fcm.googleapis.com",
    "android.googleapis.com",
    "push.services.mozilla.com",
    "updates.push.services.mozilla.com",
    "push.apple.com",
    "notify.windows.com",
    "wns.windows.com",
    "push.opera.com",
    "pushsvc.ucweb.com",
    "web.push.samsung.com",
    "push.yandex.ru",
)


def validate_push_endpoint(url: str) -> str:
    url = url.strip()
    if len(url) > 2048:
        raise ValueError("Endpoint URL too long.")
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host:
        raise ValueError("Push endpoint must be an https URL.")
    if not any(host == suf or host.endswith("." + suf) for suf in _PUSH_HOST_SUFFIXES):
        raise ValueError("Push endpoint host is not a known push service.")
    return url


class PushSubscriptionKeys(BaseModel):
    """ECDH keys produced by the browser when a subscription is created."""
    p256dh: str = Field(..., max_length=255)
    auth: str = Field(..., max_length=255)


class PushSubscriptionPayload(BaseModel):
    """Shape returned by ``PushManager.subscribe()`` in the browser."""
    endpoint: str
    keys: PushSubscriptionKeys
    expirationTime: float | None = None

    @field_validator("endpoint")
    @classmethod
    def _endpoint(cls, v: str) -> str:
        return validate_push_endpoint(v)


class PushSubscribeRequest(BaseModel):
    """Body for POST /push/subscribe."""
    subscription: PushSubscriptionPayload
    user_agent: str | None = Field(default=None, max_length=512)


class PushUnsubscribeRequest(BaseModel):
    """Body for DELETE /push/subscribe — identify which subscription."""
    endpoint: str = Field(max_length=2048)


class PushVapidPublicKey(BaseModel):
    """Response for GET /push/vapid-public-key."""
    public_key: str
    enabled: bool


class PushTestResponse(BaseModel):
    """Response for POST /push/test."""
    sent: int
    removed: int = 0


class NotificationPreferencesPayload(BaseModel):
    """GET response and PATCH body for /push/preferences."""
    challenge_results: bool = True
    achievement_unlock: bool = True
    daily_reminder: bool = True
    streak_warning: bool = True


class NotificationPreferencesUpdate(BaseModel):
    """PATCH body — every field is optional so the client can toggle one."""
    challenge_results: bool | None = None
    achievement_unlock: bool | None = None
    daily_reminder: bool | None = None
    streak_warning: bool | None = None
