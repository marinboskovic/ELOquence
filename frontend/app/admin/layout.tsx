'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import TileSpinner from '@/components/TileSpinner';

/**
 * Client-side admin guard for every route under /admin.
 *
 *  - while auth is loading → TileSpinner
 *  - signed out            → /login?next=/admin
 *  - signed in, not admin  → /play
 *  - admin                 → children
 *
 * NOTE: the individual admin pages still carry their own copy of this guard
 * and render `<AdminNav/>` themselves (below their page heading). Once they
 * drop those, `<AdminNav/>` can move here. It is deliberately not rendered
 * here yet to avoid showing the sub-nav twice.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?next=/admin');
    } else if (!user.is_admin) {
      router.replace('/play');
    }
  }, [user, loading, router]);

  if (loading || !user || !user.is_admin) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-52px)]">
        <TileSpinner size="md" label="Loading" />
      </div>
    );
  }

  return <>{children}</>;
}
