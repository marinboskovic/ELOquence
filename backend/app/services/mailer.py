"""Transactional e-mail.

A deliberately tiny abstraction: one function, one provider (Resend's HTTP
API, which needs no SMTP credentials and has a free tier). Without an API
key configured the message is logged instead — the local dev loop for the
password-reset flow is then "copy the link from the backend log".
"""
from __future__ import annotations

import html
import logging

import httpx

from app.config import settings

_log = logging.getLogger(__name__)

_RESEND_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, text: str, html_body: str | None = None) -> bool:
    """Send an e-mail. Returns ``True`` when the provider accepted it.

    Never raises — callers must not leak "the mail failed" to the user in
    flows (like forgot-password) where the response has to be identical
    whether or not the address exists.
    """
    if not settings.email_enabled:
        _log.info("[mail:dev] to=%s subject=%r\n%s", to, subject, text)
        return False

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html_body or f"<pre style='font-family:sans-serif'>{html.escape(text)}</pre>",
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                _RESEND_URL,
                json=payload,
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            )
        if resp.status_code >= 300:
            _log.warning("Resend rejected mail to %s: %s %s", to, resp.status_code, resp.text[:200])
            return False
        return True
    except httpx.HTTPError as exc:
        _log.warning("Mail delivery to %s failed: %s", to, exc)
        return False


def password_reset_message(username: str, link: str) -> tuple[str, str, str]:
    """Return ``(subject, text, html)`` for the forgot-password e-mail."""
    subject = "Reset your ELOquence password"
    text = (
        f"Hi {username},\n\n"
        f"Someone asked to reset the password for your ELOquence account. "
        f"If that was you, open this link within {settings.PASSWORD_RESET_MINUTES} minutes:\n\n"
        f"{link}\n\n"
        "If you didn't request this, you can ignore this e-mail — your password won't change.\n"
    )
    safe_name = html.escape(username)
    safe_link = html.escape(link, quote=True)
    html_body = f"""
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1b">
  <h2 style="font-family:Georgia,serif;letter-spacing:-0.02em">ELOquence</h2>
  <p>Hi {safe_name},</p>
  <p>Someone asked to reset the password for your ELOquence account. If that was you,
     the button below works for {settings.PASSWORD_RESET_MINUTES} minutes.</p>
  <p style="margin:28px 0">
    <a href="{safe_link}" style="background:#6aaa64;color:#fff;text-decoration:none;
       padding:12px 20px;border-radius:6px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase">
       Reset password</a>
  </p>
  <p style="color:#787c7e;font-size:13px">If you didn't request this, ignore this e-mail — your
     password won't change.<br>Link: <a href="{safe_link}">{safe_link}</a></p>
</div>"""
    return subject, text, html_body
