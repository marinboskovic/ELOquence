'use client';
/**
 * ShrinkStrip — the landing band that replaces the old jargon marquee.
 *
 * It shows the one idea the whole product is built on, with no reading
 * required: every guess makes the list of possible answers shorter.
 *
 *   ░░░░░ (no guess yet)   ████████████████████████████████  2,309
 *   C R A N E              ████████████████                     78
 *   S L O T H              ████                                  3
 *   D E P T H              ▏                                     1
 *
 * Each row is one guess from one real game: the tiles ink-fill, the bar
 * beside them shrinks and the number counts down to how many answers
 * still fit. Plays once when scrolled into view (useSeen pattern); under
 * reduced motion it renders the finished state.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Tile from '@/components/Tile';
import { Label, useSeen } from '@/components/ui';
import { fmtInt } from '@/lib/copy';
import type { TileState } from '@/lib/types';

type Revealed = Exclude<TileState, 'empty' | 'tbd'>;
const C: Revealed = 'correct';
const P: Revealed = 'present';
const A: Revealed = 'absent';

/** One real game: the answer was DEPTH. */
const POOL = 2309;
const STAGES: { word: string | null; states: Revealed[]; left: number; note: string }[] = [
  { word: null, states: [], left: POOL, note: 'possible answers' },
  { word: 'CRANE', states: [A, A, A, A, P], left: 78, note: 'still fit' },
  { word: 'SLOTH', states: [A, A, A, C, C], left: 3, note: 'still fit' },
  { word: 'DEPTH', states: [C, C, C, C, C], left: 1, note: 'solved' },
];

const STEP_MS = 1150; // time between rows
const TILE = 'clamp(22px, 2.6vw, 30px)';
const TILE_GAP = 3;

/** Bar width on a log scale so 78 and 3 are both still visible. */
function widthFor(n: number) {
  if (n <= 1) return 0.6; // a hairline for "one word left"
  return Math.max(2, (Math.log(n) / Math.log(POOL)) * 100);
}

/** Counts from `from` down to `to` once `active` (800ms, ease-out). */
function CountDown({ from, to, active, reduced }: { from: number; to: number; active: boolean; reduced: boolean }) {
  const [shown, setShown] = useState(reduced ? to : from);
  useEffect(() => {
    if (reduced) {
      setShown(to);
      return;
    }
    if (!active) {
      setShown(from);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 800);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, from, to, reduced]);
  return <>{fmtInt(shown)}</>;
}

export default function ShrinkStrip() {
  const ref = useRef<HTMLElement>(null);
  const seen = useSeen(ref, '-15% 0px');
  const reduced = useReducedMotion() ?? false;
  // How many rows have "played" (0 = nothing yet, STAGES.length = done).
  const [stage, setStage] = useState(reduced ? STAGES.length : 0);

  useEffect(() => {
    if (reduced) {
      setStage(STAGES.length);
      return;
    }
    if (!seen) return;
    const timers: number[] = [];
    for (let i = 1; i <= STAGES.length; i++) {
      timers.push(window.setTimeout(() => setStage(i), 350 + (i - 1) * STEP_MS));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [seen, reduced]);

  const described = STAGES.map((s, i) =>
    i === 0 ? `${fmtInt(s.left)} possible answers to begin with` : `after guessing ${s.word}, ${fmtInt(s.left)} ${s.left === 1 ? 'answer is' : 'answers are'} left`
  ).join('; ');

  return (
    <section ref={ref} className="rule-top border-b border-border-subtle" aria-label="How the list of possible answers shrinks">
      <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-8 md:py-10 grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-6">
        <div className="md:col-span-3">
          <Label className="block">one real game</Label>
          <p className="mt-2 font-display text-display-sm text-text-primary text-balance">
            Every guess makes the list of possible answers shorter.
          </p>
          <p className="sr-only">{described}</p>
        </div>

        <ul className="md:col-span-9 flex flex-col gap-3 md:gap-3.5 min-w-0" aria-hidden="true">
          {STAGES.map((s, i) => {
            // Row i becomes active when stage > i. Before that it shows the
            // previous count (the list has not shrunk yet).
            const active = stage > i;
            const prevLeft = i === 0 ? POOL : STAGES[i - 1].left;
            const from = i === 0 ? POOL : prevLeft;
            const width = active ? widthFor(s.left) : widthFor(prevLeft);
            const dim = active ? 1 : 0.45;
            return (
              <li key={i} className="grid items-center gap-3 md:gap-5" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto' }}>
                {/* the guess */}
                <div className="flex" style={{ gap: TILE_GAP }}>
                  {Array.from({ length: 5 }, (_, c) => {
                    const letter = s.word ? s.word[c] : '';
                    const state: TileState = !s.word ? 'empty' : active ? s.states[c] : 'tbd';
                    return (
                      <Tile
                        key={`${c}-${state}`}
                        letter={letter}
                        state={state}
                        position={c}
                        isFlipping={active && !reduced && !!s.word}
                        flipDelay={active && !reduced ? c * 0.08 : 0}
                        size={TILE}
                      />
                    );
                  })}
                </div>

                {/* the shrinking list */}
                <div className="h-[clamp(22px,2.6vw,30px)] flex items-center min-w-0">
                  <motion.div
                    className="h-2.5 md:h-3 bg-bg-ink"
                    initial={false}
                    animate={{ width: `${width}%`, opacity: dim }}
                    transition={reduced ? { duration: 0 } : { duration: 0.8, ease: [0.7, 0, 0.2, 1], delay: s.word ? 0.3 : 0 }}
                    style={{ minWidth: 2 }}
                  />
                </div>

                {/* the count */}
                <div className="text-right w-[5.5ch] md:w-[7ch] shrink-0">
                  <div className="font-display font-black tabular leading-none tracking-[-0.03em] text-xl md:text-2xl text-text-primary">
                    <CountDown from={from} to={s.left} active={active} reduced={reduced} />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-secondary mt-1 whitespace-nowrap">
                    {active ? s.note : i === 0 ? s.note : 'left'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
