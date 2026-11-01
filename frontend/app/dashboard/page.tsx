'use client';
/**
 * /dashboard merged into the profile page. Signed-in players land on their
 * own /u/<username>; guests go to login and come back here afterwards.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TileLoader from '@/components/TileLoader';
import { useAuth } from '@/lib/hooks/useAuth';

export default function DashboardRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? `/u/${encodeURIComponent(user.username)}` : '/login?next=/dashboard');
  }, [user, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-page">
      <TileLoader size={20} />
    </div>
  );
}
