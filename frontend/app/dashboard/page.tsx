'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import TileLoader from '@/components/TileLoader';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, usersApi, challengesApi } from '@/lib/api';
import { Game, getRatingTier, RATING_TIERS, EloHistoryEntry, Classification } from '@/lib/types';
import EloSparkline from '@/components/EloSparkline';
import GuessDistribution from '@/components/GuessDistribution';
import InstallPrompt from '@/components/InstallPrompt';
import NemesisWords, { type NemesisWord } from '@/components/dashboard/NemesisWords';
import PaceHabits, { type PaceStats, type FavouriteOpener } from '@/components/dashboard/PaceHabits';
import {
  Button,
  ButtonLink,
  CountUp,
  Label,
  MiniTiles,
  Reveal,
  Stat,
  Tag,
  staggerChild,
  staggerParent,
} from '@/components/ui';
import clsx from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  won: 'Won',
  lost: 'Lost',
  in_progress: 'In progress',
  abandoned: 'Abandoned',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

function formatMMSS(seconds: number): string {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

type TierTone = 'neutral' | 'ochre' | 'green' | 'ink';
function tierTone(name: string): TierTone {
  if (name === 'Veteran') return 'ochre';
  if (name === 'Master') return 'green';
  if (name === 'Grandmaster') return 'ink';
  return 'neutral';
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ModeStat {
  completed: number;
  wins: number;
  losses: number;
  win_rate: number;
  avg_guesses: number | null;
  distribution: Record<string, number>;
}
interface UserStats {
  guess_distribution?: Record<string, number>;
  losses?: number;
  /** Per-mode aggregates over the player's ENTIRE history, plus an `all`
   *  aggregate. Keyed by 'daily' | 'competitive' | 'practice' | 'challenge'
   *  | 'all'. Computed server-side, so — unlike the capped recent-games list
   *  below — it is not limited to the 20 games the dashboard fetches. */
  mode_stats?: Record<string, ModeStat>;
  nemesis_words?: NemesisWord[];
  pace?: PaceStats;
  favourite_opener?: FavouriteOpener | null;
  classification_mix?: Partial<Record<Classification, number>>;
  [key: string]: unknown;
}

type ModeFilter = 'all' | 'daily' | 'practice' | 'competitive' | 'challenge';

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={clsx('skeleton bg-bg-muted', className)} style={style} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [games,          setGames]         = useState<Game[]>([]);
  const [loadingGames,   setLoadingGames]   = useState(true);
  const [gameFilter,     setGameFilter]     = useState<ModeFilter>('all');
  // Client-side pagination over the fetched games. The list itself is
  // already capped at the API's per_page (currently 20) — for deeper
  // history users go through /archive.
  const [recentPage,     setRecentPage]    = useState(1);
  // Map of target_word → challenge code, used to route challenge-mode games
  // in Recent Games to the challenge results page instead of the review page.
  const [challengeCodeByWord, setChallengeCodeByWord] = useState<Record<string, string>>({});
  const [deletingId,     setDeletingId]     = useState<string | null>(null);
  const [eloHistory,     setEloHistory]     = useState<EloHistoryEntry[]>([]);
  const [userStats,      setUserStats]      = useState<UserStats | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingStats,   setLoadingStats]   = useState(false);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  // Reset to page 1 whenever the mode filter changes — otherwise the
  // visible page can sit beyond the new filtered list's end.
  useEffect(() => {
    setRecentPage(1);
  }, [gameFilter]);

  // Fetch recent games for the active mode filter. Refetched when the filter
  // changes so the Recent Games list actually reflects that mode (per-mode
  // COUNTS and the stat row come from the server aggregate in `userStats`,
  // not from this capped 20-game list). The cancel guard drops stale
  // responses if the user flips filters quickly.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingGames(true);
    gamesApi
      .list({ per_page: 20, mode: gameFilter === 'all' ? undefined : gameFilter })
      .then((res) => {
        if (cancelled) return;
        const d = res.data;
        setGames(Array.isArray(d) ? d : d.games ?? d.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingGames(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, gameFilter]);

  // Fetch user's challenges so we can route challenge games to their results
  useEffect(() => {
    if (!user) return;
    challengesApi
      .mine()
      .then((res) => {
        const map: Record<string, string> = {};
        for (const c of res.data as Array<{ code: string; target_word: string }>) {
          map[c.target_word.toUpperCase()] = c.code;
        }
        setChallengeCodeByWord(map);
      })
      .catch(() => {});
  }, [user]);

  // Fetch ELO history
  useEffect(() => {
    if (!user) return;
    setLoadingHistory(true);
    usersApi
      .eloHistory(90)
      .then((res) => {
        const d = res.data;
        setEloHistory(Array.isArray(d) ? d : d.history ?? d.entries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [user]);

  // Fetch user stats
  useEffect(() => {
    if (!user) return;
    setLoadingStats(true);
    usersApi
      .stats()
      .then((res) => setUserStats(res.data))
      .catch(() => {})
      .finally(() => setLoadingStats(false));
  }, [user]);

  const handleDelete = async (gameId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(gameId);
    try {
      await gamesApi.delete(gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
    } catch {
      // silent
    } finally {
      setDeletingId(null);
    }
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-page">
        <TileLoader size={20} />
      </div>
    );
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const tier      = getRatingTier(user.elo_rating);
  const tierIndex = RATING_TIERS.findIndex((t) => t.name === tier.name);
  const nextTier  = RATING_TIERS[tierIndex + 1] ?? null;
  const tierMin   = tier.min;
  const tierMax   = nextTier ? nextTier.min - 1 : tier.max;
  const tierRange = tierMax - tierMin;
  const tierProgress =
    tierRange > 0
      ? Math.max(0, Math.min(100, ((user.elo_rating - tierMin) / tierRange) * 100))
      : 100;
  const toNextTier = nextTier ? Math.max(0, nextTier.min - user.elo_rating) : 0;

  // The Recent Games list is driven by the per-mode fetch above, so the
  // fetched `games` are already scoped to the active filter.
  const completedGames = games.filter(
    (g) =>
      g.status === 'won' ||
      g.status === 'lost' ||
      (g.status === 'abandoned' && g.rated),
  );

  const RECENT_PER_PAGE = 5;
  const recentTotalPages = Math.max(1, Math.ceil(completedGames.length / RECENT_PER_PAGE));
  const recentClampedPage = Math.min(recentPage, recentTotalPages);
  const recentVisible = completedGames.slice(
    (recentClampedPage - 1) * RECENT_PER_PAGE,
    recentClampedPage * RECENT_PER_PAGE,
  );

  // ── Stat row + tab counts come from the server-side aggregate
  // (`userStats.mode_stats`), computed over the player's ENTIRE history —
  // NOT from the 20-game window above. The client fallback is only used until
  // the stats request resolves (or if it fails).
  const modeStats = userStats?.mode_stats;
  const filterStat = modeStats?.[gameFilter];
  const modeCount = (key: ModeFilter): number | undefined => modeStats?.[key]?.completed;

  const wonGamesFiltered = completedGames.filter((g) => g.status === 'won');
  const gamesPlayedFiltered = filterStat?.completed ?? completedGames.length;
  const winRate = Math.round(
    filterStat?.win_rate ??
      (completedGames.length > 0
        ? (wonGamesFiltered.length / completedGames.length) * 100
        : 0),
  );
  const avgGuessesNum: number | null =
    filterStat != null
      ? filterStat.avg_guesses
      : wonGamesFiltered.length > 0
        ? wonGamesFiltered.reduce((s, g) => s + g.num_guesses, 0) / wonGamesFiltered.length
        : null;

  const guessDistribution: Record<string, number> =
    filterStat?.distribution ??
    completedGames
      .filter((g) => g.status === 'won')
      .reduce<Record<string, number>>((acc, g) => {
        const k = String(g.num_guesses);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});

  const lossCount =
    filterStat?.losses ?? completedGames.filter((g) => g.status === 'lost').length;

  const monthName = new Date().toLocaleDateString('en-US', { month: 'long' }).toLowerCase();

  const FILTERS: { key: ModeFilter; label: string }[] = [
    { key: 'all',         label: 'all' },
    { key: 'daily',       label: 'daily' },
    { key: 'practice',    label: 'practice' },
    { key: 'competitive', label: 'competitive' },
    { key: 'challenge',   label: 'challenge' },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-12 md:gap-16">

      {/* ── INSTALL NUDGE (first login, this device) ───────────────────── */}
      <InstallPrompt />

      {/* ── HERO: rating + sparkline ───────────────────────────────────── */}
      <section aria-label="Rating overview" className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-end">
        <div className="md:col-span-7 min-w-0">
          <Label className="block">dashboard · {monthName}</Label>
          <h1 className="font-display text-display-xl text-text-primary tabular mt-3 leading-none">
            <CountUp value={Math.round(user.elo_rating)} duration={1100} format={(n) => String(Math.round(n))} />
          </h1>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Tag tone={tierTone(tier.name)}>{tier.name}</Tag>
            {user.is_placement && <Tag tone="ochre">placement {user.games_played}/5</Tag>}
            {user.current_streak > 0 && <Tag tone="neutral" dot="var(--accent)">streak {user.current_streak}</Tag>}
          </div>
          <div className="mt-5 flex items-baseline gap-4 flex-wrap">
            <p className="font-display font-bold text-display-sm text-text-primary">{user.username}</p>
            <Link
              href={`/u/${encodeURIComponent(user.username)}`}
              className="ink-link font-mono text-label uppercase text-text-secondary"
            >
              public profile →
            </Link>
          </div>

          {/* Tier progress — one thin ink rule */}
          <div className="mt-6 max-w-sm">
            <div className="flex items-center justify-between mb-2 font-mono text-label uppercase text-text-tertiary tabular">
              <span>{tier.name.toLowerCase()}</span>
              <span>{nextTier ? `${toNextTier} to ${nextTier.name.toLowerCase()}` : 'top tier'}</span>
            </div>
            <div
              className="h-px w-full bg-bg-muted relative"
              role="progressbar"
              aria-valuenow={Math.round(tierProgress)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${tier.name} tier progress`}
            >
              <motion.div
                className="absolute inset-y-0 left-0 bg-bg-ink"
                style={{ height: 2, top: -0.5 }}
                initial={{ width: 0 }}
                animate={{ width: `${tierProgress}%` }}
                transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.4 }}
              />
            </div>
          </div>
        </div>

        <Reveal delay={0.1} className="md:col-span-5 min-w-0" aria-label="Rating history chart">
          <div className="flex items-baseline justify-between mb-2">
            <Label>rating · last 90</Label>
            {eloHistory.length > 0 && (
              <span className="font-mono text-xs tabular text-text-tertiary">
                {eloHistory.length} game{eloHistory.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {loadingHistory ? (
            <Skeleton className="w-full" style={{ height: 180 }} />
          ) : (
            <EloSparkline data={eloHistory} height={180} />
          )}
        </Reveal>
      </section>

      {/* ── MODE FILTER + STAT ROW ─────────────────────────────────────── */}
      <section aria-label="Player statistics" className="flex flex-col gap-6">
        <div
          role="tablist"
          aria-label="Filter by mode"
          className="flex gap-6 overflow-x-auto hide-native-scrollbar border-b border-border-subtle"
        >
          {FILTERS.map((opt) => {
            const active = gameFilter === opt.key;
            const count = modeCount(opt.key);
            return (
              <button
                key={opt.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setGameFilter(opt.key)}
                className={clsx(
                  'relative shrink-0 pb-3 -mb-px font-mono text-label uppercase transition-colors duration-fast',
                  active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {opt.label}
                {count !== undefined && <span className="ml-1.5 tabular text-text-tertiary">{count}</span>}
                {active && (
                  <motion.span
                    layoutId="dash-tab-underline"
                    className="absolute left-0 right-0 bottom-0 h-0.5 bg-accent"
                    transition={{ duration: 0.26, ease: [0.7, 0, 0.2, 1] }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="rule-top pt-1 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6">
          <Stat label="games" value={gamesPlayedFiltered} />
          <Stat label="win rate" value={`${winRate}%`} sub={`${lossCount} lost`} />
          <Stat
            label="avg guesses"
            value={avgGuessesNum != null ? avgGuessesNum.toFixed(1) : '—'}
            sub="per win"
          />
          <Stat label="streak" value={user.current_streak} sub={`best ${user.max_streak}`} />
        </div>
      </section>

      {/* ── DISTRIBUTION ───────────────────────────────────────────────── */}
      <Reveal as="section" aria-label="Guess distribution" className="grid grid-cols-1 md:grid-cols-12 gap-8">
        <div className="md:col-span-4 rule-top pt-3">
          <Label className="block mb-1">distribution</Label>
          <h2 className="font-display text-display-md text-text-primary">Guesses to solve</h2>
          <p className="text-sm text-text-secondary mt-3 max-w-xs">
            How many rows it took, across {gameFilter === 'all' ? 'every mode' : `${gameFilter} games`}. X is a loss.
          </p>
        </div>
        <div className="md:col-span-8 md:pt-3">
          {loadingStats ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rule-hair flex items-center gap-3 py-1.5">
                  <Skeleton className="h-3 w-6" />
                  <Skeleton className="h-4" style={{ width: `${30 + i * 8}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <GuessDistribution distribution={guessDistribution} losses={lossCount} />
          )}
        </div>
      </Reveal>

      {/* ── NEMESIS + PACE (7/5) ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
        <div className="md:col-span-7 min-w-0">
          <NemesisWords words={userStats?.nemesis_words} loading={loadingStats} delay={0.05} />
        </div>
        <div className="md:col-span-5 min-w-0">
          <PaceHabits
            pace={userStats?.pace}
            favouriteOpener={userStats?.favourite_opener}
            classificationMix={userStats?.classification_mix}
            loading={loadingStats}
            delay={0.12}
          />
        </div>
      </div>

      {/* ── RECENT GAMES ───────────────────────────────────────────────── */}
      <Reveal as="section" aria-label="Recent games">
        <div className="rule-top pt-3 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <Label className="block mb-1">recent · {gameFilter}</Label>
            <h2 className="font-display text-display-md text-text-primary">Last games</h2>
          </div>
          <Link href="/play" className="ink-link font-mono text-label uppercase text-text-primary" aria-label="Play a new game">
            play new →
          </Link>
        </div>

        {loadingGames ? (
          <div className="mt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rule-hair flex items-center gap-4 py-3">
                <Skeleton className="h-[22px] w-[122px]" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-4 w-10 ml-auto" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        ) : completedGames.length === 0 ? (
          /* Empty state — the page's one ink block */
          <div className="mt-6 bg-bg-ink text-text-on-ink px-6 py-10 md:px-10 md:py-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <p className="font-display text-display-md max-w-md">
              {gameFilter === 'all' ? 'Nothing on the ledger yet.' : `No ${gameFilter} games finished yet.`}
            </p>
            {gameFilter === 'all' ? (
              <ButtonLink href="/play" variant="primary" size="md">play a game</ButtonLink>
            ) : (
              <Button variant="secondary" size="md" onClick={() => setGameFilter('all')} className="!border-text-on-ink !text-text-on-ink">
                show all
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="rule-hair">
                  <th scope="col" className="text-left py-2 pr-4"><Label>word</Label></th>
                  <th scope="col" className="text-left py-2 pr-4 hidden sm:table-cell"><Label>mode</Label></th>
                  <th scope="col" className="text-right py-2 pr-4"><Label>result</Label></th>
                  <th scope="col" className="text-right py-2 pr-4"><Label>±elo</Label></th>
                  <th scope="col" className="text-right py-2 pr-4 hidden sm:table-cell"><Label>time</Label></th>
                  <th scope="col" className="text-right py-2 pr-2"><Label>when</Label></th>
                  <th scope="col" className="py-2"><span className="sr-only">Delete</span></th>
                </tr>
              </thead>
              <motion.tbody variants={staggerParent} initial="hidden" animate="show" key={`${gameFilter}-${recentClampedPage}`}>
                {recentVisible.map((game) => {
                  const statusLabel = STATUS_LABEL[game.status] ?? STATUS_LABEL.abandoned;
                  const isClickable = game.status === 'won' || game.status === 'lost';
                  const eloDelta    = game.elo_delta;
                  const showWord    =
                    !(game.status === 'in_progress') &&
                    !(game.status === 'abandoned' && game.mode === 'daily');
                  const word = showWord ? (game.target_word ?? '—') : '?????';
                  const tileStates = showWord
                    ? game.status === 'won'
                      ? (['correct', 'correct', 'correct', 'correct', 'correct'] as const)
                      : undefined
                    : (['empty', 'empty', 'empty', 'empty', 'empty'] as const);

                  const challengeCode =
                    game.mode === 'challenge'
                      ? challengeCodeByWord[game.target_word?.toUpperCase() ?? '']
                      : undefined;
                  const go = () => {
                    if (!isClickable) return;
                    if (challengeCode) router.push(`/challenge/${challengeCode}`);
                    else router.push(`/review/${game.id}`);
                  };

                  const result = game.status === 'won' ? `${game.num_guesses}/6` : game.status === 'lost' ? 'X' : '—';

                  return (
                    <motion.tr
                      key={game.id}
                      variants={staggerChild}
                      onClick={go}
                      onKeyDown={(e) => {
                        if (!isClickable) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          go();
                        }
                      }}
                      tabIndex={isClickable ? 0 : undefined}
                      aria-label={
                        isClickable
                          ? (challengeCode
                              ? `Challenge results for ${word}`
                              : `Review ${word} — ${statusLabel}`)
                          : undefined
                      }
                      className={clsx(
                        'border-b border-border-subtle transition-colors duration-fast',
                        isClickable ? 'cursor-pointer hover:bg-bg-elevated' : 'cursor-default'
                      )}
                    >
                      <td className="py-3 pr-4">
                        <span className="inline-flex items-center gap-3">
                          <MiniTiles word={word.toUpperCase().slice(0, 5)} states={tileStates ? [...tileStates] : undefined} size={22} />
                          <span className="sm:hidden font-mono text-label uppercase text-text-tertiary">{game.mode}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-4 hidden sm:table-cell">
                        <Label>
                          {game.mode}
                          {game.is_placement && game.mode === 'competitive' && ' · placement'}
                          {game.hard_mode && ' · hard'}
                        </Label>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <span className={clsx('font-display font-bold text-lg tabular', game.status === 'won' ? 'text-text-primary' : 'text-text-secondary')}>
                          {result}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right">
                        {eloDelta !== null && game.rated ? (
                          <span className={clsx('font-mono text-sm tabular', (eloDelta ?? 0) >= 0 ? 'text-accent' : 'text-text-tertiary')}>
                            {(eloDelta ?? 0) >= 0 ? '+' : ''}
                            {Math.round(eloDelta ?? 0)}
                          </span>
                        ) : (
                          <span className="font-mono text-sm text-text-ghost">·</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right hidden sm:table-cell">
                        <span className="font-mono text-xs tabular text-text-secondary">
                          {game.time_seconds != null ? formatMMSS(game.time_seconds) : '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-2 text-right">
                        <span className="font-mono text-xs tabular text-text-tertiary whitespace-nowrap">{formatDate(game.created_at)}</span>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="!px-2 !h-8"
                          onClick={(e) => handleDelete(game.id, e)}
                          loading={deletingId === game.id}
                          aria-label={`Delete game — ${word}`}
                        >
                          {deletingId !== game.id && <Trash2 size={13} />}
                        </Button>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        )}

        {/* Pagination — only when there's more than one page */}
        {!loadingGames && completedGames.length > RECENT_PER_PAGE && (
          <div className="flex items-center justify-between gap-3 pt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
              disabled={recentClampedPage <= 1}
              aria-label="Previous page"
            >
              ← prev
            </Button>
            <span className="font-mono text-label uppercase tabular text-text-secondary" aria-live="polite">
              page {recentClampedPage} / {recentTotalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRecentPage((p) => Math.min(recentTotalPages, p + 1))}
              disabled={recentClampedPage >= recentTotalPages}
              aria-label="Next page"
            >
              next →
            </Button>
          </div>
        )}
      </Reveal>
    </div>
  );
}
