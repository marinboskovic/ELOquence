'use client';
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import TileSpinner from '@/components/TileSpinner';
import { Label } from '@/components/ui';

/**
 * Final hop of the Google sign-in. The token pair arrives in the URL
 * fragment (`#access=…&refresh=…&next=/play`), which never reaches any
 * server log. We store it, scrub the URL from history and move on.
 */
export default function GoogleCompletePage() {
  const router = useRouter();
  const { adoptTokens } = useAuth();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const access = params.get('access');
    const refresh = params.get('refresh');
    const nextRaw = params.get('next') || '/play';
    const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/play';

    // Scrub the fragment immediately so a screenshot / history entry
    // doesn't carry the tokens.
    window.history.replaceState(null, '', window.location.pathname);

    if (!access || !refresh) {
      router.replace('/login?error=google');
      return;
    }
    adoptTokens({ access_token: access, refresh_token: refresh })
      .then((u) => router.replace(u?.is_admin ? '/admin' : next))
      .catch(() => router.replace('/login?error=google'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-page gap-5">
      <TileSpinner size="md" label="Signing you in" />
      <Label>signing you in</Label>
    </div>
  );
}
