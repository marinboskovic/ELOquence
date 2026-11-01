'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import clsx from 'clsx';
import type { Game } from '@/lib/types';
import { MODES, ratingDelta, resultSentence } from '@/lib/copy';
import { useViewMode } from '@/lib/viewMode';
import { Button, ButtonLink, Label, MiniTiles, Reveal, staggerChild, staggerParent } from '@/components/ui';
import type { ModeFilter, ModeStat } from './useOwnerData';
import { Skeleton, formatMMSS, formatWhen } from './shared';

const FILTERS: { key: ModeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'daily', label: MODES.daily.short },
  { key: 'competitive', label: MODES.competitive.short },
  { key: 'practice', label: MODES.practice.short },
  { key: 'challenge', label: MODES.challenge.short },
];

const PER_PAGE = 5;

interface Props {
  games: Game[];
  loading: boolean;
  filter: ModeFilter;
  onFilter: (f: ModeFilter) => void;
  /** Server-side per-mode aggregates — tab counts and the one-line summary. */
  modeStats: Record<string, ModeStat> | undefined;
  challengeCodeByWord: Record<string, string>;
  deletingId: string | null;
  onDelete: (gameId: string) => void;
}

/**
 * "Your games" — owner only. Mode tabs, a ledger of finished games (each
 * row opens its review), delete, and client-side paging over the 20 most
 * recent games the API returns.
 */
export default function GamesTable({ games, loading, filter, onFilter, modeStats, challengeCodeByWord, deletingId, onDelete }: Props) {
  const router = useRouter();
  const { detailed } = useViewMode();
  const [page, setPage] = useState(1);

  // Back to page 1 whenever the filter changes — otherwise the visible page
  // can sit beyond the new list's end.
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const completed = games.filter((g) => g.status === 'won' || g.status === 'lost' || (g.status === 'abandoned' && g.rated));
  const totalPages = Math.max(1, Math.ceil(completed.length / PER_PAGE));
  const current = Math.min(page, totalPages);
  const visible = completed.slice((current - 1) * PER_PAGE, current * PER_PAGE);

  const stat = modeStats?.[filter];
  const filterName = filter === 'all' ? 'all modes' : MODES[filter].short;
  const summary =
    stat && stat.completed > 0
      ? [
          `${stat.completed} game${stat.completed === 1 ? '' : 's'}`,
          `${Math.round(stat.win_rate)}% solved`,
          stat.avg_guesses != null ? `usually ${stat.avg_guesses.toFixed(1)} guesses` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <Reveal as="section" aria-label="Your games" className="flex flex-col gap-5">
      <div className="rule-top pt-3 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <Label className="block mb-1">history · {filterName}</Label>
          <h2 className="font-display text-display-md text-text-primary">Your games</h2>
        </div>
        {!loading && completed.length > 0 && (
          <ButtonLink href="/play" variant="primary" size="sm">
            play a game
          </ButtonLink>
        )}
      </div>

      {/* Mode tabs */}
      <div className="flex flex-col gap-3">
        <div
          role="tablist"
          aria-label="Filter by mode"
          className="flex gap-6 overflow-x-auto hide-native-scrollbar scroll-fade-x md:[mask-image:none] border-b border-border-subtle"
        >
          {FILTERS.map((opt) => {
            const active = filter === opt.key;
            const count = modeStats?.[opt.key]?.completed;
            return (
              <button
                key={opt.key}
                role="tab"
                type="button"
                aria-selected={active}
                aria-current={active ? 'page' : undefined}
                onClick={() => onFilter(opt.key)}
                className={clsx(
                  'relative shrink-0 pb-3 -mb-px font-mono text-label uppercase transition-colors duration-fast',
                  active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {opt.label}
                {count !== undefined && <span className="ml-1.5 tabular text-text-tertiary">{count}</span>}
                {active && (
                  <motion.span
                    layoutId="profile-tab-underline"
                    className="absolute left-0 right-0 bottom-0 h-0.5 bg-accent"
                    transition={{ duration: 0.26, ease: [0.7, 0, 0.2, 1] }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {summary && (
          <p className="text-sm text-text-secondary">
            <span className="font-mono text-label uppercase text-text-tertiary mr-2">{filterName}</span>
            {summary}
          </p>
        )}
      </div>

      {loading ? (
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rule-hair flex items-center gap-4 py-3">
              <Skeleton className="h-[22px] w-[122px]" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-4 w-16 ml-auto" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      ) : completed.length === 0 ? (
        /* Empty state — the page's one ink block */
        <div className="bg-bg-ink text-text-on-ink px-6 py-10 md:px-10 md:py-14 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="font-display text-display-md max-w-md">
              {filter === 'all' ? 'No games finished yet.' : `No ${MODES[filter].short} games finished yet.`}
            </p>
            <p className="text-sm opacity-80 mt-2 max-w-md">
              {filter === 'all' ? 'Every game you finish shows up here, with a review you can open.' : MODES[filter].tagline}
            </p>
          </div>
          {filter === 'all' ? (
            <ButtonLink href="/play" variant="on-ink" size="md" className="shrink-0">
              play your first game
            </ButtonLink>
          ) : (
            <Button variant="on-ink" size="md" onClick={() => onFilter('all')} className="shrink-0">
              show all games
            </Button>
          )}
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="rule-hair">
                <th scope="col" className="text-left py-2 pr-4"><Label>word</Label></th>
                <th scope="col" className="text-left py-2 pr-4 hidden sm:table-cell"><Label>mode</Label></th>
                <th scope="col" className="text-left py-2 pr-4"><Label>result</Label></th>
                <th scope="col" className="text-right py-2 pr-4"><Label>rating</Label></th>
                {detailed && <th scope="col" className="text-right py-2 pr-4 hidden sm:table-cell"><Label>time</Label></th>}
                <th scope="col" className="text-right py-2 pr-2"><Label>when</Label></th>
                <th scope="col" className="py-2"><span className="sr-only">Delete</span></th>
              </tr>
            </thead>
            <motion.tbody variants={staggerParent} initial="hidden" animate="show" key={`${filter}-${current}`}>
              {visible.map((game) => {
                const isClickable = game.status === 'won' || game.status === 'lost';
                const showWord = !(game.status === 'abandoned' && game.mode === 'daily');
                const word = showWord ? (game.target_word ?? '—') : '?????';
                const tileStates = showWord
                  ? game.status === 'won'
                    ? (['correct', 'correct', 'correct', 'correct', 'correct'] as const)
                    : undefined
                  : (['empty', 'empty', 'empty', 'empty', 'empty'] as const);
                const result = resultSentence(game.status, game.num_guesses);
                const modeLabel = MODES[game.mode]?.short ?? game.mode;
                const modeExtra = [game.hard_mode ? 'hard' : null, detailed && game.is_placement && game.mode === 'competitive' ? 'first 5' : null]
                  .filter(Boolean)
                  .join(' · ');
                const delta = ratingDelta(game.rated ? game.elo_delta : null);
                const deltaUp = game.rated && (game.elo_delta ?? 0) > 0;

                const challengeCode = game.mode === 'challenge' ? challengeCodeByWord[game.target_word?.toUpperCase() ?? ''] : undefined;
                const go = () => {
                  if (!isClickable) return;
                  if (challengeCode) router.push(`/challenge/${challengeCode}`);
                  else router.push(`/review/${game.id}`);
                };

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
                    aria-label={isClickable ? (challengeCode ? `Friends results for ${word}` : `Review ${word} — ${result}`) : undefined}
                    className={clsx(
                      'border-b border-border-subtle transition-colors duration-fast',
                      isClickable ? 'cursor-pointer hover:bg-bg-elevated' : 'cursor-default'
                    )}
                  >
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-3">
                        <MiniTiles word={word.toUpperCase().slice(0, 5)} states={tileStates ? [...tileStates] : undefined} size={22} />
                        <span className="sm:hidden font-mono text-label uppercase text-text-tertiary">{modeLabel}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      <Label>
                        {modeLabel}
                        {modeExtra && ` · ${modeExtra}`}
                      </Label>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={clsx('font-display font-bold text-base tabular whitespace-nowrap', game.status === 'won' ? 'text-text-primary' : 'text-text-secondary')}>
                        {result}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className={clsx('font-mono text-sm tabular', delta === '—' ? 'text-text-tertiary' : deltaUp ? 'text-accent' : 'text-text-secondary')}>
                        {delta}
                      </span>
                    </td>
                    {detailed && (
                      <td className="py-3 pr-4 text-right hidden sm:table-cell">
                        <span className="font-mono text-xs tabular text-text-secondary">{formatMMSS(game.time_seconds)}</span>
                      </td>
                    )}
                    <td className="py-3 pr-2 text-right">
                      <span className="font-mono text-xs tabular text-text-tertiary whitespace-nowrap">{formatWhen(game.created_at)}</span>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!px-2 !h-8"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDelete(game.id);
                        }}
                        loading={deletingId === game.id}
                        aria-label={`Delete game — ${word}`}
                      >
                        {deletingId !== game.id && <Trash2 size={13} aria-hidden="true" />}
                      </Button>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      )}

      {!loading && completed.length > PER_PAGE && (
        <div className="flex items-center justify-between gap-3">
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={current <= 1} aria-label="Previous page">
            ← prev
          </Button>
          <span className="font-mono text-label uppercase tabular text-text-secondary" aria-live="polite">
            page {current} / {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={current >= totalPages}
            aria-label="Next page"
          >
            next →
          </Button>
        </div>
      )}
    </Reveal>
  );
}
