'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import StatCardLg from '@/components/admin/StatCardLg';
import TimeSeriesChart from '@/components/admin/TimeSeriesChart';
import TileSpinner from '@/components/TileSpinner';
import Histogram from '@/components/admin/Histogram';
import DonutChart from '@/components/admin/DonutChart';
import { CountUp, Label, Reveal, Stat, buttonClass } from '@/components/ui';
import { AdminLoading, AdminPage, ErrorBand, PanelHead } from './_shared';

interface Analytics {
  total_users: number;
  total_games: number;
  games_today: number;
  games_this_week: number;
  new_users_today: number;
  new_users_week: number;
  active_games: number;
  avg_accuracy: number;
  avg_guesses: number;
  win_rate: number;
  dau: number;
  wau: number;
}

interface TimeseriesEntry {
  date: string;
  signups: number;
  games_total: number;
  games_daily: number;
  games_competitive: number;
  games_practice: number;
  games_challenge: number;
  active_users: number;
  avg_accuracy: number | null;
  wins: number;
  losses: number;
}

interface Distributions {
  elo_buckets: Array<{ min: number; max: number; count: number }>;
  mode_distribution: { daily: number; competitive: number; practice: number; challenge: number };
  outcome_distribution: { won: number; lost: number; abandoned: number; in_progress: number };
  guesses_to_win: Record<string, number>;
}

type TimeseriesTab = 'games' | 'users' | 'quality';

const RANGE_OPTIONS = [7, 30, 90] as const;
type Range = typeof RANGE_OPTIONS[number];

/* Chart palette: ink + the two coloured tiles + accent. */
const INK = 'var(--text-primary)';
const C_CORRECT = 'var(--tile-correct)';
const C_PRESENT = 'var(--tile-present)';
const C_ABSENT = 'var(--tile-absent)';
const C_ACCENT = 'var(--accent)';
const C_GREY = 'var(--text-tertiary)';

function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  render,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  render?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={String(opt)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt)}
            className={buttonClass(active ? 'ink' : 'secondary', 'sm')}
          >
            {render ? render(opt) : String(opt)}
          </button>
        );
      })}
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesEntry[]>([]);
  const [distributions, setDistributions] = useState<Distributions | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [tsTab, setTsTab] = useState<TimeseriesTab>('games');
  const [tsRange, setTsRange] = useState<Range>(30);
  const [tsLoading, setTsLoading] = useState(false);

  const fetchTimeseries = useCallback((days: Range) => {
    setTsLoading(true);
    adminApi.timeseries(days)
      .then((res) => setTimeseries(res.data.series ?? []))
      .catch(() => {})
      .finally(() => setTsLoading(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    Promise.all([
      adminApi.analytics(),
      adminApi.timeseries(30),
      adminApi.distributions(),
    ])
      .then(([analyticsRes, tsRes, distRes]) => {
        setAnalytics(analyticsRes.data);
        setTimeseries(tsRes.data.series ?? []);
        setDistributions(distRes.data);
      })
      .catch(() => setError('Failed to load analytics.'))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  if (loading || fetching) return <AdminLoading />;

  if (!user?.is_admin) return null;

  // Sparkline: last 14 days signups
  const last14Signups = timeseries.slice(-14).map((d) => d.signups);
  const last14Games = timeseries.slice(-14).map((d) => d.games_total);

  // DAU trend vs 7 days ago
  const dauNow = analytics?.dau ?? 0;
  const dauPrev = timeseries.length >= 8 ? timeseries[timeseries.length - 8]?.active_users ?? dauNow : dauNow;
  const dauTrendVal = dauPrev > 0 ? ((dauNow - dauPrev) / dauPrev) * 100 : 0;

  // Users trend (new_users_today vs yesterday)
  const signupsToday = timeseries.length >= 1 ? (timeseries[timeseries.length - 1]?.signups ?? 0) : 0;
  const signupsYesterday = timeseries.length >= 2 ? (timeseries[timeseries.length - 2]?.signups ?? signupsToday) : signupsToday;
  const signupsTrendVal = signupsYesterday > 0 ? ((signupsToday - signupsYesterday) / signupsYesterday) * 100 : 0;

  // ELO buckets for histogram
  const eloBuckets = (distributions?.elo_buckets ?? []).map((b) => ({
    label: `${b.min}`,
    count: b.count,
  }));

  // Mode distribution for donut
  const modeSegs = distributions
    ? [
        { key: 'daily', label: 'Daily', value: distributions.mode_distribution.daily, color: INK },
        { key: 'competitive', label: 'Competitive', value: distributions.mode_distribution.competitive, color: C_CORRECT },
        { key: 'practice', label: 'Practice', value: distributions.mode_distribution.practice, color: C_PRESENT },
        { key: 'challenge', label: 'Challenge', value: distributions.mode_distribution.challenge, color: C_ACCENT },
      ]
    : [];

  const outcomeSegs = distributions
    ? [
        { key: 'won', label: 'Won', value: distributions.outcome_distribution.won, color: C_CORRECT },
        { key: 'lost', label: 'Lost', value: distributions.outcome_distribution.lost, color: INK },
        { key: 'abandoned', label: 'Abandoned', value: distributions.outcome_distribution.abandoned, color: C_ABSENT },
        { key: 'in_progress', label: 'In progress', value: distributions.outcome_distribution.in_progress, color: C_PRESENT },
      ]
    : [];

  // Timeseries series defs based on tab
  const tsSeries: Array<{ key: string; label: string; color: string }> = tsTab === 'games'
    ? [
        { key: 'games_daily', label: 'Daily', color: INK },
        { key: 'games_competitive', label: 'Competitive', color: C_CORRECT },
        { key: 'games_practice', label: 'Practice', color: C_PRESENT },
      ]
    : tsTab === 'users'
    ? [
        { key: 'signups', label: 'New users', color: C_ACCENT },
        { key: 'active_users', label: 'DAU', color: INK },
      ]
    : [
        { key: 'avg_accuracy', label: 'Avg accuracy', color: INK },
      ];

  const subPages = [
    { href: '/admin/users', label: 'Users', description: 'Search, reset ELO, manage admins, bans' },
    { href: '/admin/games', label: 'Games', description: 'Browse and inspect every game' },
    { href: '/admin/words', label: 'Words', description: 'Schedule upcoming daily words' },
    { href: '/admin/announcements', label: 'Announcements', description: 'Post and manage banners' },
    { href: '/admin/audit', label: 'Audit', description: 'Admin action history' },
    { href: '/admin/health', label: 'Health', description: 'DB status, uptime, version' },
  ];

  const smallStats: Array<{ label: string; value: number | string; count?: boolean }> = analytics
    ? [
        { label: 'total games', value: analytics.total_games },
        { label: 'games this week', value: analytics.games_this_week },
        { label: 'new users today', value: analytics.new_users_today ?? 0 },
        { label: 'new users · week', value: analytics.new_users_week ?? 0 },
        { label: 'avg accuracy', value: analytics.avg_accuracy != null ? `${analytics.avg_accuracy.toFixed(1)}%` : '—' },
        { label: 'win rate', value: analytics.win_rate != null ? `${analytics.win_rate.toFixed(1)}%` : '—' },
        { label: 'avg guesses', value: analytics.avg_guesses != null ? analytics.avg_guesses.toFixed(2) : '—' },
        { label: 'wau', value: analytics.wau ?? 0 },
      ]
    : [];

  const month = new Date().toLocaleDateString('en-US', { month: 'long' }).toLowerCase();

  return (
    <AdminPage eyebrow={`admin · overview · ${month}`} title="Platform">
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      <div className="flex flex-col gap-12 md:gap-16">
        {/* ── Headline numbers: 7/5 — DAU as the one ink block, the rest as Stats ── */}
        {analytics && (
          <Reveal as="section" className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
            <div className="md:col-span-5 bg-bg-ink text-text-on-ink p-6 md:p-8 flex flex-col justify-between gap-6">
              <Label className="text-text-on-ink opacity-70">daily active</Label>
              <div className="font-display text-display-xl tabular leading-none text-text-on-ink">
                <CountUp value={analytics.dau} />
              </div>
              <div className="flex items-end justify-between gap-4">
                <span className="font-mono text-xs opacity-70 tabular">
                  {dauTrendVal !== 0
                    ? `${dauTrendVal >= 0 ? '▲' : '▼'} ${Math.abs(dauTrendVal).toFixed(1)}% vs 7d ago`
                    : 'flat vs 7d ago'}
                </span>
                <span className="font-mono text-xs opacity-70 tabular">{(analytics.wau ?? 0).toLocaleString()} wau</span>
              </div>
            </div>
            <div className="md:col-span-7 grid grid-cols-2 gap-x-8 gap-y-6 content-start">
              <StatCardLg
                label="total users"
                value={analytics.total_users}
                sparkline={last14Signups}
                trend={signupsTrendVal !== 0 ? { value: Math.abs(signupsTrendVal), direction: signupsTrendVal >= 0 ? 'up' : 'down' } : undefined}
              />
              <StatCardLg label="games today" value={analytics.games_today} sparkline={last14Games} />
              <StatCardLg label="active games" value={analytics.active_games ?? 0} />
              <StatCardLg label="games this week" value={analytics.games_this_week} />
            </div>
          </Reveal>
        )}

        {/* ── Secondary stats: a single hair-ruled row of 8 ── */}
        {analytics && (
          <Reveal as="section" delay={0.05} className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6">
            {smallStats.map((s) => (
              <Stat key={s.label} label={s.label} value={s.value} size="sm" />
            ))}
          </Reveal>
        )}

        {/* ── Activity chart ── */}
        <Reveal as="section" delay={0.1}>
          <PanelHead
            title={`Activity · last ${tsRange} days`}
            aside={
              <div className="flex flex-wrap items-center gap-3">
                <Segmented<TimeseriesTab>
                  label="Series"
                  options={['games', 'users', 'quality']}
                  value={tsTab}
                  onChange={setTsTab}
                  render={(t) => (t === 'quality' ? 'Accuracy' : t)}
                />
                <Segmented<Range>
                  label="Range"
                  options={RANGE_OPTIONS}
                  value={tsRange}
                  onChange={(r) => {
                    setTsRange(r);
                    fetchTimeseries(r);
                  }}
                  render={(r) => `${r}d`}
                />
              </div>
            }
          />
          {tsLoading ? (
            <div className="flex items-center justify-center h-[220px]">
              <TileSpinner size="sm" label="Loading chart" />
            </div>
          ) : (
            <TimeSeriesChart data={timeseries} series={tsSeries} height={220} />
          )}
        </Reveal>

        {/* ── Distributions: 7/5 ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          <Reveal as="section" delay={0.12} className="md:col-span-7">
            <PanelHead title="ELO distribution" aside="players per bucket" />
            <Histogram buckets={eloBuckets} height={200} />
          </Reveal>

          <Reveal as="section" delay={0.15} className="md:col-span-5">
            <PanelHead title="Games by mode" />
            <DonutChart
              segments={modeSegs.filter((s) => s.value > 0)}
              size={132}
              centerLabel="games"
              centerValue={modeSegs.reduce((s, seg) => s + seg.value, 0).toLocaleString()}
              ariaLabel="Games by mode"
            />
          </Reveal>
        </div>

        {/* ── Outcomes + index: 5/7 ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          <Reveal as="section" delay={0.18} className="md:col-span-5">
            <PanelHead title="Game outcomes" />
            <DonutChart segments={outcomeSegs.filter((s) => s.value > 0)} size={132} ariaLabel="Game outcomes" />
          </Reveal>

          <Reveal as="section" delay={0.2} className="md:col-span-7">
            <PanelHead title="Index" aside="admin pages" />
            <ul>
              {subPages.map((page, i) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className={clsx(
                      'group flex items-center gap-4 py-3 border-b border-border-subtle hover:bg-bg-elevated transition-colors',
                      i === 0 && 'border-t'
                    )}
                  >
                    <span className="font-mono text-[10px] text-text-tertiary tabular w-5">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-display font-bold text-text-primary w-36">{page.label}</span>
                    <span className="text-sm text-text-secondary flex-1 min-w-0 truncate">{page.description}</span>
                    <ArrowUpRight size={14} className="text-text-tertiary group-hover:text-text-primary transition-colors" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </AdminPage>
  );
}
