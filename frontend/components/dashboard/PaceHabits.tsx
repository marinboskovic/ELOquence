'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gauge, Zap, Clock, Hash, FlaskConical } from 'lucide-react';
import { springs } from '@/lib/animations';
import { Classification } from '@/lib/types';
import MiniWord from './MiniWord';

export interface PaceStats {
  avg_win_seconds: number | null;
  timed_wins: number;
  fastest_win: { word: string; num_guesses: number; seconds: number; mode: string } | null;
}

export interface FavouriteOpener {
  word: string;
  plays: number;
  solve_rate: number;
}

interface PaceHabitsProps {
  pace: PaceStats | undefined;
  favouriteOpener: FavouriteOpener | null | undefined;
  classificationMix: Partial<Record<Classification, number>> | undefined;
  loading?: boolean;
  delay?: number;
}

function formatMMSS(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={`skeleton rounded-md bg-bg-muted ${className ?? ''}`} />;
}

// Three buckets for the mix bar: strong / meh / weak moves.
const GOOD: Classification[] = ['brilliant', 'best', 'good'];
const OKAY: Classification[] = ['okay', 'inaccuracy'];
const BAD: Classification[] = ['mistake', 'blunder'];

function sum(mix: Partial<Record<Classification, number>>, keys: Classification[]): number {
  return keys.reduce((acc, k) => acc + (mix[k] ?? 0), 0);
}

export default function PaceHabits({
  pace,
  favouriteOpener,
  classificationMix,
  loading = false,
  delay = 0,
}: PaceHabitsProps) {
  const mix = classificationMix ?? {};
  const good = sum(mix, GOOD);
  const okay = sum(mix, OKAY);
  const bad = sum(mix, BAD);
  const mixTotal = good + okay + bad;
  const pct = (n: number) => (mixTotal > 0 ? (n / mixTotal) * 100 : 0);

  const segments = [
    { label: 'Strong', value: good, color: 'var(--tile-correct)' },
    { label: 'Okay', value: okay, color: 'var(--tile-present)' },
    { label: 'Weak', value: bad, color: 'var(--cls-red)' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.slide, delay }}
      className="rounded-card-lg bg-bg-elevated border border-border-subtle p-5"
      aria-label="Pace and habits"
    >
      <div className="flex items-center gap-2 mb-4">
        <Gauge size={14} className="text-text-ghost" />
        <span className="font-sans font-semibold text-sm text-text-primary">Pace &amp; Habits</span>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-14" />
            <Shimmer className="h-14" />
          </div>
          <Shimmer className="h-10 w-full" />
          <Shimmer className="h-2 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Timing */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 p-3 rounded-card bg-bg-base border border-border-subtle">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                <Clock size={10} />
                Avg win time
              </span>
              <span className="font-display text-2xl font-black tabular-nums text-text-primary leading-none">
                {formatMMSS(pace?.avg_win_seconds)}
              </span>
              <span className="font-sans text-[10px] text-text-ghost tabular-nums">
                {pace?.timed_wins ? `${pace.timed_wins} timed win${pace.timed_wins !== 1 ? 's' : ''}` : 'No timed wins yet'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded-card bg-bg-base border border-border-subtle min-w-0">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                <Zap size={10} />
                Fastest win
              </span>
              {pace?.fastest_win ? (
                <>
                  <span className="font-display text-2xl font-black tabular-nums text-text-primary leading-none">
                    {formatMMSS(pace.fastest_win.seconds)}
                  </span>
                  <span className="font-sans text-[10px] text-text-ghost truncate">
                    <span className="font-mono font-semibold uppercase tracking-wider text-text-secondary">
                      {pace.fastest_win.word}
                    </span>
                    {' · '}
                    <span className="font-mono tabular-nums">{pace.fastest_win.num_guesses}/6</span>
                    {' · '}
                    <span className="capitalize">{pace.fastest_win.mode}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="font-display text-2xl font-black text-text-primary leading-none">—</span>
                  <span className="font-sans text-[10px] text-text-ghost">Win a timed game</span>
                </>
              )}
            </div>
          </div>

          {/* Favourite opener */}
          <div className="flex items-center gap-3 p-3 rounded-card bg-bg-base border border-border-subtle">
            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                <Hash size={10} />
                Favourite opener
              </span>
              {favouriteOpener ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <MiniWord word={favouriteOpener.word} />
                  <span className="font-sans text-xs text-text-secondary tabular-nums">
                    <span className="font-mono font-semibold text-text-primary">{favouriteOpener.plays}</span>{' '}
                    {favouriteOpener.plays === 1 ? 'play' : 'plays'}
                    {' · '}
                    <span className="font-mono font-semibold text-text-primary">
                      {Math.round(favouriteOpener.solve_rate)}%
                    </span>{' '}
                    solved
                  </span>
                </div>
              ) : (
                <span className="font-sans text-xs text-text-secondary">Finish a game to find your go-to opener.</span>
              )}
            </div>
            {favouriteOpener && (
              <Link
                href={`/lab?word=${encodeURIComponent(favouriteOpener.word.toUpperCase())}`}
                className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors rounded px-1.5 py-1 hover:bg-bg-muted"
                aria-label={`Analyse ${favouriteOpener.word.toUpperCase()} in the Opener Lab`}
              >
                <FlaskConical size={11} />
                <span className="hidden sm:inline">Open in Lab</span>
                <span className="sm:hidden">Lab</span>
              </Link>
            )}
          </div>

          {/* Classification mix */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                Move quality mix
              </span>
              {mixTotal > 0 && (
                <span className="font-sans text-[10px] font-mono tabular-nums text-text-ghost">
                  {mixTotal.toLocaleString()} analysed moves
                </span>
              )}
            </div>
            {mixTotal === 0 ? (
              <p className="font-sans text-xs text-text-secondary">Review a finished game to start building your mix.</p>
            ) : (
              <>
                <div
                  className="flex h-2 w-full rounded-pill overflow-hidden bg-bg-muted border border-border-subtle"
                  role="img"
                  aria-label={`Strong ${Math.round(pct(good))}%, okay ${Math.round(pct(okay))}%, weak ${Math.round(pct(bad))}%`}
                >
                  {segments.map((seg) =>
                    seg.value > 0 ? (
                      <motion.div
                        key={seg.label}
                        className="h-full"
                        style={{ backgroundColor: seg.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct(seg.value)}%` }}
                        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: delay + 0.1 }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {segments.map((seg) => (
                    <span key={seg.label} className="inline-flex items-center gap-1.5 font-sans text-[11px] text-text-secondary">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: seg.color }} aria-hidden="true" />
                      {seg.label}
                      <span className="font-mono tabular-nums text-text-primary font-semibold">{Math.round(pct(seg.value))}%</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}
