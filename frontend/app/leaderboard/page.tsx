'use client';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { leaderboardApi, type SeasonBoard, type SeasonEntry } from '@/lib/api';
import { getRatingTier } from '@/lib/types';
import { Button, Label, MiniTiles, Reveal, SplitWords, Tag, staggerChild, staggerParent } from '@/components/ui';
import clsx from 'clsx';

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  elo_rating: number;
  games_played: number;
  wins: number;
}

// ─── Small pieces ─────────────────────────────────────────────────────────────
function TierDot({ elo }: { elo: number }) {
  const tier = getRatingTier(elo);
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: tier.color }}
      aria-label={tier.name}
      title={tier.name}
    />
  );
}

/** Rank numeral: oversized display type for the podium, mono for the rest. */
function Rank({ rank }: { rank: number | null }) {
  if (rank == null) return <span className="font-mono text-sm text-text-ghost">—</span>;
  if (rank <= 3) {
    return (
      <span className="font-display text-display-md text-text-primary tabular leading-none" aria-label={`Rank ${rank}`}>
        {rank}
      </span>
    );
  }
  return (
    <span className="font-mono text-sm tabular text-text-tertiary" aria-label={`Rank ${rank}`}>
      {String(rank).padStart(2, '0')}
    </span>
  );
}

/** Row background: wash for the top three, accent left rule for "you". */
function rowClass(rank: number | null, isMe: boolean, pinned = false) {
  return clsx(
    'border-b border-border-subtle transition-colors duration-fast',
    rank === 1 && 'bg-wash-green',
    (rank === 2 || rank === 3) && 'bg-wash-ochre',
    rank != null && rank > 3 && !isMe && 'hover:bg-bg-elevated',
    isMe && 'border-l-4 border-l-accent',
    pinned && 'border-t-2 border-t-border-default'
  );
}

function Name({ username, isMe }: { username: string; isMe: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Link
        href={`/u/${encodeURIComponent(username)}`}
        title={username}
        className="ink-link font-display font-bold text-base text-text-primary truncate"
      >
        {username}
      </Link>
      {isMe && <Label className="text-text-tertiary shrink-0">you</Label>}
    </span>
  );
}

function SkeletonRows({ count, cols }: { count: number; cols: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-border-subtle">
          <td className="py-3 pl-3 pr-2 w-14"><div className="skeleton bg-bg-muted h-3 w-6" /></td>
          <td className="py-3 pr-4"><div className="skeleton bg-bg-muted h-4 w-32" /></td>
          {Array.from({ length: cols - 2 }).map((__, j) => (
            <td key={j} className="py-3 pr-4"><div className="skeleton bg-bg-muted h-3 w-10 ml-auto" /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-ink text-text-on-ink px-6 py-10 md:px-10 md:py-12">
      <p className="font-display text-display-md max-w-lg">{children}</p>
    </div>
  );
}

const TH = 'py-2 text-left';
const TH_R = 'py-2 text-right';

// ─── Openers tab ──────────────────────────────────────────────────────────────
interface OpenerRow {
  rank: number;
  opener: string;
  plays: number;
  wins: number;
  solve_rate: number;
  avg_guesses_win: number | null;
  popularity_pct: number;
}

function OpenersPanel() {
  const [rows, setRows] = useState<OpenerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leaderboardApi
      .openers(20)
      .then((res) => {
        const data = res.data as { total_games: number; openers: OpenerRow[] };
        setRows(data.openers ?? []);
        setTotal(data.total_games ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const maxPop = Math.max(1, ...rows.map((r) => r.popularity_pct));

  return (
    <Reveal>
      <table className="w-full border-collapse">
        <thead>
          <tr className="rule-top">
            <th scope="col" className={clsx(TH, 'pl-3 pr-2 w-14')}><Label>#</Label></th>
            <th scope="col" className={clsx(TH, 'pr-4')}><Label>opener</Label></th>
            <th scope="col" className={clsx(TH, 'pr-4 hidden md:table-cell w-[28%]')}><Label>share</Label></th>
            <th scope="col" className={clsx(TH_R, 'pr-4 w-16')}><Label>used</Label></th>
            <th scope="col" className={clsx(TH_R, 'pr-4 w-16')}><Label>solve</Label></th>
            <th scope="col" className={clsx(TH_R, 'pr-3 w-14')}><Label>avg</Label></th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows count={10} cols={6} />
          ) : rows.length === 0 ? (
            <tr><td colSpan={6} className="pt-6"><EmptyBand>No completed games yet.</EmptyBand></td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.opener} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast">
                <td className="py-3 pl-3 pr-2"><Rank rank={r.rank} /></td>
                <td className="py-3 pr-4"><MiniTiles word={r.opener.toUpperCase().slice(0, 5)} size={22} /></td>
                <td className="py-3 pr-4 hidden md:table-cell">
                  <div className="relative h-4 w-full">
                    <motion.span
                      className="absolute left-0 top-1/2 h-0.5 bg-bg-ink"
                      style={{ marginTop: -1 }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(r.popularity_pct / maxPop) * 100}%` }}
                      transition={{ duration: 0.48, ease: [0.7, 0, 0.2, 1], delay: Math.min(r.rank * 0.03, 0.4) }}
                      aria-hidden="true"
                    />
                  </div>
                </td>
                <td className="py-3 pr-4 text-right font-mono text-xs tabular text-text-secondary">{r.popularity_pct}%</td>
                <td className="py-3 pr-4 text-right font-mono text-xs tabular text-text-primary">{r.solve_rate}%</td>
                <td className="py-3 pr-3 text-right font-mono text-xs tabular text-text-secondary">
                  {r.avg_guesses_win != null ? r.avg_guesses_win.toFixed(1) : '—'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      {!loading && total > 0 && (
        <p className="mt-3 font-mono text-label uppercase text-text-tertiary">
          from {total.toLocaleString()} completed games · avg = guesses to win when this opener led
        </p>
      )}
    </Reveal>
  );
}

// ─── Season tab ───────────────────────────────────────────────────────────────
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function EloGain({ gain }: { gain: number }) {
  const rounded = Math.round(gain);
  const text = rounded > 0 ? `+${rounded}` : rounded < 0 ? `−${Math.abs(rounded)}` : '0';
  return (
    <span className={clsx('font-display font-bold text-base tabular', rounded > 0 ? 'text-accent' : rounded < 0 ? 'text-text-tertiary' : 'text-text-secondary')}>
      {text}
    </span>
  );
}

function SeasonRow({ entry, isMe, pinned = false }: { entry: SeasonEntry; isMe: boolean; pinned?: boolean }) {
  return (
    <motion.tr variants={staggerChild} className={rowClass(entry.rank, isMe, pinned)}>
      <td className={clsx('py-3 pr-2 w-14', isMe ? 'pl-2' : 'pl-3')}><Rank rank={entry.rank} /></td>
      <td className="py-3 pr-4">
        <span className="inline-flex items-center gap-2 min-w-0">
          <TierDot elo={Math.round(entry.elo_rating)} />
          <Name username={entry.username} isMe={isMe} />
        </span>
      </td>
      <td className="py-3 pr-4 text-right"><EloGain gain={entry.elo_gain} /></td>
      <td className="py-3 pr-4 text-right font-mono text-xs tabular text-text-secondary">{entry.games}</td>
      <td className="py-3 pr-4 text-right font-mono text-xs tabular text-text-secondary">{entry.wins}</td>
      <td className="py-3 pr-3 text-right font-mono text-xs tabular text-text-secondary hidden sm:table-cell">
        {entry.peak_elo != null ? Math.round(entry.peak_elo) : '—'}
      </td>
    </motion.tr>
  );
}

function SeasonPanel({ currentUserId }: { currentUserId: string | null }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1–12
  const [board, setBoard] = useState<SeasonBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    leaderboardApi
      .season({ year, month })
      .then((res) => {
        if (!cancelled) setBoard(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setBoard(null);
          setError('Could not load this season.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const entries = board?.entries ?? [];
  const me = board?.me ?? null;
  const meInList = !!me && entries.some((e) => e.user_id === me.user_id);
  const showPinnedMe = !!me && !meInList;

  return (
    <Reveal className="flex flex-col gap-6">
      {/* Season header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-end gap-4 flex-wrap min-w-0">
          <h2 className="font-display text-display-md text-text-primary" aria-live="polite">
            {MONTH_NAMES[month - 1]} <span className="text-text-tertiary">{year}</span>
          </h2>
          {board && (
            <div className="flex items-center gap-2 pb-1">
              {board.season.is_current ? (
                <Tag tone="accent" dot="var(--accent)">
                  {board.season.days_left} day{board.season.days_left !== 1 ? 's' : ''} left
                </Tag>
              ) : (
                <Tag tone="neutral">ended</Tag>
              )}
              <span className="font-mono text-xs tabular text-text-tertiary">
                {board.total_players.toLocaleString()} player{board.total_players !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={prevMonth} aria-label="Previous month" className="!px-2.5">
            <ChevronLeft size={14} />
          </Button>
          <Button variant="secondary" size="sm" onClick={nextMonth} disabled={isCurrentMonth} aria-label="Next month" className="!px-2.5">
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      <div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="rule-top">
              <th scope="col" className={clsx(TH, 'pl-3 pr-2 w-14')}><Label>#</Label></th>
              <th scope="col" className={clsx(TH, 'pr-4')}><Label>player</Label></th>
              <th scope="col" className={clsx(TH_R, 'pr-4 w-20')}><Label>gained</Label></th>
              <th scope="col" className={clsx(TH_R, 'pr-4 w-16')}><Label>games</Label></th>
              <th scope="col" className={clsx(TH_R, 'pr-4 w-14')}><Label>wins</Label></th>
              <th scope="col" className={clsx(TH_R, 'pr-3 w-16 hidden sm:table-cell')}><Label>peak</Label></th>
            </tr>
          </thead>
          {loading ? (
            <tbody><SkeletonRows count={8} cols={6} /></tbody>
          ) : error ? (
            <tbody>
              <tr><td colSpan={6} className="pt-6"><EmptyBand>{error}</EmptyBand></td></tr>
            </tbody>
          ) : entries.length === 0 ? (
            <tbody>
              <tr><td colSpan={6} className="pt-6"><EmptyBand>No rated games this month yet.</EmptyBand></td></tr>
            </tbody>
          ) : (
            <motion.tbody variants={staggerParent} initial="hidden" animate="show" key={`${year}-${month}`}>
              {entries.map((e) => (
                <SeasonRow key={e.user_id} entry={e} isMe={!!currentUserId && e.user_id === currentUserId} />
              ))}
              {showPinnedMe && me && <SeasonRow entry={me} isMe pinned />}
            </motion.tbody>
          )}
        </table>
        <p className="mt-3 font-mono text-label uppercase text-text-tertiary">
          ranked by elo gained from rated games this month · peak = highest rating reached
        </p>
      </div>
    </Reveal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type LeaderboardTab = 'players' | 'season' | 'openers';

const TABS: { key: LeaderboardTab; label: string; blurb: string }[] = [
  { key: 'players', label: 'players', blurb: 'Every player, ranked by rating.' },
  { key: 'season',  label: 'season',  blurb: 'Who climbed the most this month.' },
  { key: 'openers', label: 'openers', blurb: 'The most-played opening words across all completed games.' },
];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LeaderboardTab>('players');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PER_PAGE = 20;

  useEffect(() => {
    if (tab !== 'players') return;
    setLoading(true);
    leaderboardApi
      .get({ page, per_page: PER_PAGE })
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        setEntries(list);
        setHasMore(list.length === PER_PAGE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, tab]);

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' }).toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10 md:gap-12">

      {/* Title */}
      <header className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-8">
          <Label className="block mb-3">leaderboard · {monthName}</Label>
          <SplitWords text="The ladder" as="h1" className="font-display text-display-lg text-text-primary" />
        </div>
        <p className="md:col-span-4 text-sm text-text-secondary md:pb-2" aria-live="polite">
          {TABS.find((t) => t.key === tab)?.blurb}
        </p>
      </header>

      {/* Tab strip */}
      <div role="tablist" aria-label="Leaderboard views" className="flex gap-8 border-b border-border-subtle">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={clsx(
                'relative pb-3 -mb-px font-mono text-label uppercase transition-colors duration-fast',
                active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {t.label}
              {active && (
                <motion.span
                  layoutId="lb-tab-underline"
                  className="absolute left-0 right-0 bottom-0 h-0.5 bg-accent"
                  transition={{ duration: 0.26, ease: [0.7, 0, 0.2, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === 'openers' && <OpenersPanel />}
      {tab === 'season' && <SeasonPanel currentUserId={user?.id ?? null} />}

      {tab === 'players' && (
        <Reveal className="flex flex-col gap-6">
          <table className="w-full border-collapse">
            <thead>
              <tr className="rule-top">
                <th scope="col" className={clsx(TH, 'pl-3 pr-2 w-14')}><Label>#</Label></th>
                <th scope="col" className={clsx(TH, 'pr-4')}><Label>player</Label></th>
                <th scope="col" className={clsx(TH_R, 'pr-4 w-20')}><Label>rating</Label></th>
                <th scope="col" className={clsx(TH_R, 'pr-4 w-16')}><Label>games</Label></th>
                <th scope="col" className={clsx(TH_R, 'pr-3 w-14')}><Label>win</Label></th>
              </tr>
            </thead>
            {loading ? (
              <tbody><SkeletonRows count={10} cols={5} /></tbody>
            ) : entries.length === 0 ? (
              <tbody>
                <tr><td colSpan={5} className="pt-6"><EmptyBand>No players yet. Be the first.</EmptyBand></td></tr>
              </tbody>
            ) : (
              <motion.tbody variants={staggerParent} initial="hidden" animate="show" key={page}>
                {entries.map((entry) => {
                  const isMe = !!user && entry.user_id === user.id;
                  const winRate = entry.games_played > 0 ? Math.round((entry.wins / entry.games_played) * 100) : 0;
                  return (
                    <motion.tr key={entry.user_id} variants={staggerChild} className={rowClass(entry.rank, isMe)}>
                      <td className={clsx('py-3 pr-2 w-14 align-middle', isMe ? 'pl-2' : 'pl-3')}><Rank rank={entry.rank} /></td>
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-2 min-w-0">
                          <TierDot elo={Math.round(entry.elo_rating)} />
                          <Name username={entry.username} isMe={isMe} />
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className="font-display font-bold text-base tabular text-text-primary">{Math.round(entry.elo_rating)}</span>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-xs tabular text-text-secondary">{entry.games_played}</td>
                      <td className="py-3 pr-3 text-right font-mono text-xs tabular text-text-secondary">{winRate}%</td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            )}
          </table>

          {!loading && (entries.length > 0 || page > 1) && (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
                previous
              </Button>
              <span className="font-mono text-label uppercase tabular text-text-secondary">page {page}</span>
              <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
                next
                <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </Reveal>
      )}
    </div>
  );
}
