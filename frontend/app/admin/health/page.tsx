'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Button, Label, Reveal, Stat, Tag } from '@/components/ui';
import { AdminLoading, AdminPage, ErrorBand, PanelHead, PanelLoading } from '../_shared';

interface HealthData {
  db: { ok: boolean; latency_ms: number | null };
  uptime_seconds: number | null;
  version: string;
  checks: { games_table: number; users_table: number; audit_log_size: number };
}

function formatUptime(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''}`;
  const h = Math.floor(m / 60);
  const remainingM = m % 60;
  if (h < 24) {
    return remainingM > 0
      ? `${h} hour${h !== 1 ? 's' : ''} ${remainingM} minute${remainingM !== 1 ? 's' : ''}`
      : `${h} hour${h !== 1 ? 's' : ''}`;
  }
  const d = Math.floor(h / 24);
  const remainingH = h % 24;
  return remainingH > 0
    ? `${d} day${d !== 1 ? 's' : ''} ${remainingH} hour${remainingH !== 1 ? 's' : ''}`
    : `${d} day${d !== 1 ? 's' : ''}`;
}

export default function AdminHealthPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchHealth = useCallback(() => {
    setFetching(true);
    setError('');
    adminApi.health()
      .then((res) => {
        setHealth(res.data);
        setLastRefreshed(new Date());
      })
      .catch(() => setError('Failed to load health data.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchHealth();
  }, [user, loading, router, fetchHealth]);

  if (loading) return <AdminLoading />;

  if (!user?.is_admin) return null;

  const ok = health?.db.ok ?? false;

  return (
    <AdminPage
      eyebrow={`admin · system health${lastRefreshed ? ` · refreshed ${lastRefreshed.toLocaleTimeString()}` : ''}`}
      title="Health"
      aside={
        <Button type="button" variant="secondary" size="sm" onClick={fetchHealth} loading={fetching}>
          {!fetching && <RefreshCw size={13} aria-hidden="true" />}
          Refresh
        </Button>
      }
    >
      {error && <ErrorBand>{error}</ErrorBand>}

      {fetching && !health ? (
        <PanelLoading label="Loading health" rows={4} />
      ) : health ? (
        <div className="flex flex-col gap-12 md:gap-16">
          {/* ── Status: ink block for the DB verdict + two stats ── */}
          <Reveal as="section" className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            <div className={`md:col-span-5 p-6 md:p-8 flex flex-col justify-between gap-6 ${ok ? 'bg-bg-ink text-text-on-ink' : 'bg-wash-accent text-text-primary'}`}>
              <Label className={ok ? 'text-text-on-ink opacity-70' : ''}>database</Label>
              <div className="font-display text-display-lg">{ok ? 'Healthy' : 'Error'}</div>
              <div className="flex items-center justify-between gap-4 font-mono text-xs tabular">
                <span className={ok ? 'opacity-70' : 'text-text-secondary'}>
                  {health.db.latency_ms !== null ? `${health.db.latency_ms.toFixed(1)} ms latency` : 'latency unknown'}
                </span>
                <Tag tone={ok ? 'green' : 'accent'} dot={ok ? 'var(--tile-correct)' : 'var(--accent)'}>
                  {ok ? 'ok' : 'down'}
                </Tag>
              </div>
            </div>
            <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 content-start">
              <Stat label="uptime" value={formatUptime(health.uptime_seconds)} size="md" />
              <Stat label="version" value={health.version || '—'} size="md" />
            </div>
          </Reveal>

          {/* ── Table sizes ── */}
          <Reveal as="section" delay={0.05}>
            <PanelHead title="Database table sizes" aside="rows" />
            <table className="w-full text-sm">
              <thead>
                <tr className="rule-top">
                  <th className="py-2 text-left font-normal"><Label>table</Label></th>
                  <th className="py-2 text-right font-normal"><Label>rows</Label></th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'users', value: health.checks.users_table },
                  { label: 'games', value: health.checks.games_table },
                  { label: 'audit log', value: health.checks.audit_log_size },
                ].map(({ label, value }) => (
                  <tr key={label} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors">
                    <td className="py-3 font-mono text-text-secondary">{label}</td>
                    <td className="py-3 text-right font-display font-bold tabular text-text-primary">{value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      ) : null}
    </AdminPage>
  );
}
