'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Classification } from '@/lib/types';
import { Hint, Label, MiniTiles, Reveal } from '@/components/ui';
import HintStat from './HintStat';

export interface PaceStats {
  avg_win_seconds: number | null;
  timed_wins: number;
  fastest_win: { word: string; num_guesses: number; seconds: number; mode: string } | null;
}

export interface FavouriteOpener {
  word: string;
  plays: number;
  /** Share of games solved when starting with this word; null on public profiles. */
  solve_rate: number | null;
}

interface PaceHabitsProps {
  /** Omit (undefined) to hide the timing stats — public profiles have none. */
  pace?: PaceStats | null;
  favouriteOpener: FavouriteOpener | null | undefined;
  /** Omit (undefined) to hide the guess-quality bar — public profiles have none. */
  classificationMix?: Partial<Record<Classification, number>> | null;
  loading?: boolean;
  delay?: number;
  /** Render the heading inside the section (default) or let the parent own it. */
  heading?: boolean;
  /** Whose habits: the viewer's own ("you") or another player's ("they"). */
  who?: 'you' | 'they';
}

function formatMMSS(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton bg-bg-muted ${className ?? ''}`} aria-hidden="true" />;
}

// Three buckets for the quality bar: strong / okay / weak guesses.
const GOOD: Classification[] = ['brilliant', 'best', 'good'];
const OKAY: Classification[] = ['okay', 'inaccuracy'];
const BAD: Classification[] = ['mistake', 'blunder'];

function sum(mix: Partial<Record<Classification, number>>, keys: Classification[]): number {
  return keys.reduce((acc, k) => acc + (mix[k] ?? 0), 0);
}

/**
 * "How you play": how long a solve usually takes, the fastest one, the
 * player's go-to first word, and the guess-quality mix as one thin stacked
 * bar (Strong / Okay / Weak).
 */
export default function PaceHabits({
  pace,
  favouriteOpener,
  classificationMix,
  loading = false,
  delay = 0,
  heading = true,
  who = 'you',
}: PaceHabitsProps) {
  const showPace = pace !== undefined;
  const showMix = classificationMix !== undefined;
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
    <Reveal as="section" delay={delay} aria-label={`How ${who} play`}>
      {heading && (
        <div className="rule-top pt-3">
          <Label className="block mb-1">habits</Label>
          <h2 className="font-display text-display-sm text-text-primary">How {who} play</h2>
        </div>
      )}

      {loading ? (
        <div className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {/* Timing */}
          {showPace && (
            <div className="grid grid-cols-2 gap-4">
              <HintStat
                size="sm"
                label={
                  <Hint title="Usual solve time" body="How long a game takes you on average, from first guess to the green row. Only timed games count.">
                    usual time
                  </Hint>
                }
                value={formatMMSS(pace?.avg_win_seconds)}
                sub={pace?.timed_wins ? `over ${pace.timed_wins} timed solve${pace.timed_wins !== 1 ? 's' : ''}` : 'no timed solves yet'}
              />
              <HintStat
                size="sm"
                label={<Hint title="Fastest solve" body="Your quickest timed win, start to finish.">fastest</Hint>}
                value={pace?.fastest_win ? formatMMSS(pace.fastest_win.seconds) : '—'}
                sub={
                  pace?.fastest_win ? (
                    <span className="font-mono tabular">
                      {pace.fastest_win.word.toUpperCase()} · solved in {pace.fastest_win.num_guesses}
                    </span>
                  ) : (
                    'solve a timed game'
                  )
                }
              />
            </div>
          )}

          {/* First word */}
          <div className="rule-hair pt-3 flex items-center gap-4 flex-wrap">
            <Label>
              <Hint term="opener">first word</Hint>
            </Label>
            {favouriteOpener ? (
              <>
                <MiniTiles word={favouriteOpener.word.toUpperCase().slice(0, 5)} size={22} />
                <span className="text-sm text-text-secondary">
                  played <span className="font-mono tabular font-semibold text-text-primary">{favouriteOpener.plays}</span> time
                  {favouriteOpener.plays === 1 ? '' : 's'}
                  {favouriteOpener.solve_rate != null && (
                    <>
                      {' · solved '}
                      <span className="font-mono tabular font-semibold text-text-primary">{Math.round(favouriteOpener.solve_rate)}%</span>
                      {' of them'}
                    </>
                  )}
                </span>
                <Link
                  href={`/lab?word=${encodeURIComponent(favouriteOpener.word.toUpperCase())}`}
                  className="ink-link ml-auto font-mono text-label uppercase text-text-primary"
                  aria-label={`Try ${favouriteOpener.word.toUpperCase()} in the Word Lab`}
                >
                  try it in word lab →
                </Link>
              </>
            ) : (
              <span className="text-sm text-text-secondary">
                {who === 'you' ? 'Finish a few games to see which first word you reach for.' : 'No first word yet.'}
              </span>
            )}
          </div>

          {/* Guess quality — one thin stacked bar */}
          {showMix && (
            <div className="rule-hair pt-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  <Hint
                    title="Guess quality"
                    body="Every guess in your reviewed games, compared with the best guess available at that moment. Strong means close to the best; weak means a much better word was there."
                  >
                    guess quality
                  </Hint>
                </Label>
                {mixTotal > 0 && (
                  <span className="font-mono text-xs tabular text-text-tertiary">{mixTotal.toLocaleString('en-US')} guesses</span>
                )}
              </div>
              {mixTotal === 0 ? (
                <p className="text-sm text-text-secondary">
                  Review a finished game to see how good your guesses are.{' '}
                  <Link href="/play" className="ink-link text-text-primary">
                    Play one →
                  </Link>
                </p>
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
          )}
        </div>
      )}
    </Reveal>
  );
}
