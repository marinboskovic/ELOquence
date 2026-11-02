/**
 * Client-side session store — access + refresh token pair.
 *
 * Tokens live in localStorage so a PWA reopened from the home screen stays
 * signed in. The access token is short-lived (30 min) and silently renewed
 * by `lib/api.ts`; the refresh token rotates on every renewal, and the
 * server revokes the whole chain if a rotated token is ever replayed.
 *
 * Everything that touches storage goes through this module so the key
 * names live in exactly one place.
 */

const ACCESS_KEY = 'eloquence_access_token';
const REFRESH_KEY = 'eloquence_refresh_token';
const LEGACY_KEY = 'token'; // pre-2.0 single JWT

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  const s = storage();
  if (!s) return null;
  return s.getItem(ACCESS_KEY) || s.getItem(LEGACY_KEY);
}

export function getRefreshToken(): string | null {
  return storage()?.getItem(REFRESH_KEY) ?? null;
}

export function setTokens(pair: TokenPair): void {
  const s = storage();
  if (!s) return;
  s.setItem(ACCESS_KEY, pair.access_token);
  if (pair.refresh_token) s.setItem(REFRESH_KEY, pair.refresh_token);
  s.removeItem(LEGACY_KEY);
  notify();
}

export function clearTokens(): void {
  const s = storage();
  if (!s) return;
  s.removeItem(ACCESS_KEY);
  s.removeItem(REFRESH_KEY);
  s.removeItem(LEGACY_KEY);
  notify();
}

export function hasSession(): boolean {
  return !!getAccessToken() || !!getRefreshToken();
}

/** Decode the JWT payload without verifying (for expiry hints only). */
export function accessTokenExpiresAt(): number | null {
  const token = getAccessToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

// ── Change notifications (same tab) ──────────────────────────────────────
type Listener = () => void;
const listeners = new Set<Listener>();

export function onSessionChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* listener errors must not break the store */
    }
  });
}

/** Learn progress cache. Kept across sign-in (guest progress migrates up), dropped on sign-out. */
export const LEARN_PROGRESS_KEY = 'eloquence.trainer.progress';

export function clearLearnProgress(): void {
  storage()?.removeItem(LEARN_PROGRESS_KEY);
}

/**
 * Keys that belong to a specific account and must not leak into the next
 * sign-in on a shared device (Learn progress, daily grid caches…).
 */
export function clearPerAccountCaches(): void {
  const s = storage();
  if (!s) return;
  const doomed: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i);
    if (!k) continue;
    if (k.startsWith('eloquence_daily_') || k.startsWith('eloquence_learn_') || k === 'eloquence_learn_progress') {
      doomed.push(k);
    }
  }
  doomed.forEach((k) => s.removeItem(k));
}
