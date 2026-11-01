'use client';
import { Button } from '@/components/ui';

interface Props {
  /** Relative path to return to after sign-in (default /play). */
  next?: string | null;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export default function GoogleSignInButton({ next }: Props) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return null;

  const handleClick = () => {
    const state = randomState();
    // Short-lived cookies the server-side callback verifies (login CSRF)
    // and uses to send the user back where they were going.
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `eloquence_oauth_state=${state}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    if (next && next.startsWith('/') && !next.startsWith('//')) {
      document.cookie = `eloquence_oauth_next=${encodeURIComponent(next)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/api/auth/callback/google`,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
      state,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  return (
    <Button type="button" variant="secondary" size="lg" onClick={handleClick} className="w-full">
      {/* Official Google "G" logo mark — colors are trademarked, must not be altered */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 010-9.18l-7.98-6.19a24.001 24.001 0 000 21.56l7.98-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      Continue with Google
    </Button>
  );
}
