import { NextRequest, NextResponse } from 'next/server';

// Server-side route. In Docker Compose we hit the sibling container via its
// service name; on Vercel we hit the public API URL the client already uses.
const PUBLIC_API = process.env.NEXT_PUBLIC_API_URL;
const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  (PUBLIC_API ? `${PUBLIC_API.replace(/\/$/, '')}/api` : 'http://backend:8000/api');

const STATE_COOKIE = 'eloquence_oauth_state';
const NEXT_COOKIE = 'eloquence_oauth_next';

function safeNext(value: string | undefined): string {
  // Relative paths only — never an absolute URL (open redirect).
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/play';
  return value;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const next = safeNext(request.cookies.get(NEXT_COOKIE)?.value);

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${reason}`, request.url));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NEXT_COOKIE);
    return res;
  };

  if (!code) return fail('google');
  // CSRF: the state we set before sending the user to Google must come back.
  if (!state || !expectedState || state !== expectedState) return fail('google_state');

  try {
    const resp = await fetch(`${BACKEND_URL}/auth/google/callback?code=${encodeURIComponent(code)}`, {
      headers: { 'X-Forwarded-For': request.headers.get('x-forwarded-for') ?? '' },
    });
    if (!resp.ok) {
      console.error('Google callback backend error:', resp.status, await resp.text());
      return fail('google');
    }
    const data = await resp.json();
    if (!data.access_token || !data.refresh_token) return fail('google');

    // Tokens travel in the URL *fragment*: fragments are never sent to the
    // server, never logged by Vercel, and never leak via Referer.
    const fragment = new URLSearchParams({
      access: data.access_token,
      refresh: data.refresh_token,
      next,
    });
    const res = NextResponse.redirect(new URL(`/auth/google/complete#${fragment}`, request.url));
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(NEXT_COOKIE);
    return res;
  } catch (err) {
    console.error('Google callback error:', err);
    return fail('google');
  }
}
