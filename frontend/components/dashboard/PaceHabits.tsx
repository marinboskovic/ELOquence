'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Classification } from '@/lib/types';
import { Label, MiniTiles, Reveal, Stat } from '@/components/ui';

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

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton bg-bg-muted ${className ?? ''}`} />;
}

// Three buckets for the mix bar: strong / meh / weak moves.
const GOOD: Classification[] = ['brilliant', 'best', 'good'];
const OKAY: Classification[] = ['okay', 'inaccuracy'];
const BAD: Classification[] = ['mistake', 'blunder'];

function sum(mix: Partial<Record<Classification, number>>, keys: Classification[]): number {
  return keys.reduce((acc, k) => acc + (mix[k] ?? 0), 0);
}

/**
 * Pace & habits: three <Stat>s (avg win time, fastest win, favourite
 * opener plays), then the move-quality mix as one thin stacked bar.
 */
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
    { label: 'strong', value: good, color: 'var(--tile-correct)' },
    { label: 'okay', value: okay, color: 'var(--tile-present)' },
    { label: 'weak', value: bad, color: 'var(--cls-red)' },
  ];

  return (
    <Reveal as="section" delay={delay} aria-label="Pace and habits">
      <div className="rule-top pt-3">
        <Label className="block mb-1">pace · habits</Label>
        <h2 className="font-display text-display-sm text-text-primary">How you play</h2>
      </div>

      {loading ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {/* Three stats */}
          <div className="grid grid-cols-3 gap-4">
            <Stat
              size="sm"
              label="avg win"
              value={formatMMSS(pace?.avg_win_seconds)}
              sub={pace?.timed_wins ? `${pace.timed_wins} timed win${pace.timed_wins !== 1 ? 's' : ''}` : 'no timed wins yet'}
            />
            <Stat
              size="sm"
              label="fastest"
              value={pace?.fastest_win ? formatMMSS(pace.fastest_win.seconds) : '—'}
              sub={
                pace?.fastest_win ? (
                  <span className="font-mono tabular">
                    {pace.fastest_win.word.toUpperCase()} · {pace.fastest_win.num_guesses}/6
                  </span>
                ) : (
                  'win a timed game'
                )
              }
            />
            <Stat
              size="sm"
              label="opener plays"
              value={favouriteOpener ? favouriteOpener.plays : '—'}
              sub={favouriteOpener ? `${Math.round(favouriteOpener.solve_rate)}% solved` : 'no opener yet'}
            />
          </div>

          {/* Favourite opener */}
          <div className="rule-hair pt-3 flex items-center gap-4 flex-wrap">
            <Label>favourite opener</Label>
            {favouriteOpener ? (
              <>
                <MiniTiles word={favouriteOpener.word.toUpperCase().slice(0, 5)} size={22} />
                <Link
                  href={`/lab?word=${encodeURIComponent(favouriteOpener.word.toUpperCase())}`}
                  className="ink-link ml-auto font-mono text-label uppercase text-text-primary"
                  aria-label={`Analyse ${favouriteOpener.word.toUpperCase()} in the Opener Lab`}
                >
                  open in lab →
                </Link>
              </>
            ) : (
              <span className="text-sm text-text-secondary">Finish a game to find your go-to opener.</span>
            )}
          </div>

          {/* Classification mix — one thin stacked bar */}
          <div className="rule-hair pt-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>move quality</Label>
              {mixTotal > 0 && (
                <span className="font-mono text-xs tabular text-text-tertiary">{mixTotal.toLocaleString()} moves</span>
              )}
            </div>
            {mixTotal === 0 ? (
              <p className="text-sm text-text-secondary">Review a finished game to start building your mix.</p>
            ) : (
              <>
                <div
                  className="flex h-1.5 w-full overflow-hidden bg-bg-muted"
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
                        transition={{ duration: 0.48, ease: [0.7, 0, 0.2, 1], delay: delay + 0.1 }}
                      />
                    ) : null,
                  )}
                </div>
                <div className="flex items-center gap-5 flex-wrap">
                  {segments.map((seg) => (
                    <span key={seg.label} className="inline-flex items-center gap-1.5 font-mono text-label uppercase text-text-secondary">
                      <span className="inline-block w-2 h-2" style={{ backgroundColor: seg.color }} aria-hidden="true" />
                      {seg.label}
                      <span className="tabular text-text-primary">{Math.round(pct(seg.value))}%</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Reveal>
  );
}
