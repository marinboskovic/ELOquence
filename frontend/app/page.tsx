'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { TileState } from '@/lib/types';
import Tile from '@/components/Tile';
import TileSpinner from '@/components/TileSpinner';
import { ButtonLink, CountUp, Label, Reveal, SplitWords } from '@/components/ui';

// ---------------------------------------------------------------------------
// Self-playing board
// ---------------------------------------------------------------------------

type Revealed = Exclude<TileState, 'empty' | 'tbd'>;
type ScriptRow = { word: string; states: Revealed[] };

const C: Revealed = 'correct';
const P: Revealed = 'present';
const A: Revealed = 'absent';

// Famous openers, then plausible follow-ups, each line solving in 3-4.
const SCRIPTS: ScriptRow[][] = [
  [
    { word: 'SLATE', states: [A, A, A, A, C] },
    { word: 'CRONY', states: [C, C, A, A, A] },
    { word: 'PRIME', states: [A, C, C, C, C] },
    { word: 'CRIME', states: [C, C, C, C, C] },
  ],
  [
    { word: 'CRANE', states: [A, A, A, P, A] },
    { word: 'POINT', states: [A, A, P, P, C] },
    { word: 'NIGHT', states: [C, C, C, C, C] },
  ],
  [
    { word: 'TARES', states: [A, P, P, A, A] },
    { word: 'RADIO', states: [P, P, A, A, A] },
    { word: 'BRAWL', states: [A, C, C, A, A] },
    { word: 'GRAPH', states: [C, C, C, C, C] },
  ],
  [
    { word: 'SALET', states: [A, C, A, C, A] },
    { word: 'CHOIR', states: [A, A, A, A, C] },
    { word: 'MANOR', states: [A, C, A, A, C] },
    { word: 'WAFER', states: [C, C, C, C, C] },
  ],
];

type BoardRow = { letters: string[]; states: TileState[]; flipping: boolean };

const EMPTY_ROW = (): BoardRow => ({ letters: Array(5).fill(''), states: Array(5).fill('empty'), flipping: false });

function fullBoard(script: ScriptRow[]): BoardRow[] {
  return Array.from({ length: 6 }, (_, i) =>
    script[i]
      ? { letters: script[i].word.split(''), states: script[i].states, flipping: false }
      : EMPTY_ROW(),
  );
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The landing signature: a real 5×6 board that types a famous opener
 * sequence by itself, ink-fills each row, pauses on the solve, clears and
 * starts the next line. Hover (or focus) pauses it. Under reduced motion it
 * is a static, fully revealed board.
 */
function AutoBoard() {
  const reduced = useReducedMotion();
  const [rows, setRows] = useState<BoardRow[]>(() => fullBoard(SCRIPTS[0]));
  const pausedRef = useRef(false);

  useEffect(() => {
    if (reduced) {
      setRows(fullBoard(SCRIPTS[0]));
      return;
    }
    let cancelled = false;

    const waitWhilePaused = async () => {
      while (pausedRef.current && !cancelled) await sleep(120);
    };
    const step = async (ms: number) => {
      await sleep(ms);
      await waitWhilePaused();
    };

    const run = async () => {
      let s = 0;
      // Start empty so the first line visibly types in.
      setRows(Array.from({ length: 6 }, EMPTY_ROW));
      await step(700);
      while (!cancelled) {
        const script = SCRIPTS[s % SCRIPTS.length];
        for (let r = 0; r < script.length && !cancelled; r++) {
          const { word, states } = script[r];
          // type
          for (let k = 1; k <= 5 && !cancelled; k++) {
            setRows((prev) =>
              prev.map((row, i) =>
                i === r
                  ? {
                      letters: [...word.slice(0, k).split(''), ...Array(5 - k).fill('')],
                      states: Array.from({ length: 5 }, (_, j) => (j < k ? 'tbd' : 'empty')) as TileState[],
                      flipping: false,
                    }
                  : row,
              ),
            );
            await step(110 + Math.random() * 70);
          }
          await step(380);
          // reveal
          setRows((prev) => prev.map((row, i) => (i === r ? { letters: word.split(''), states, flipping: true } : row)));
          await step(4 * 80 + 480 + (r === script.length - 1 ? 2600 : 900));
        }
        if (cancelled) break;
        // clear and move on
        setRows(Array.from({ length: 6 }, EMPTY_ROW));
        await step(600);
        s++;
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [reduced]);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div
      className="inline-flex flex-col"
      style={{ gap: 'clamp(4px, 0.6vw, 7px)' }}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      tabIndex={0}
      role="img"
      aria-label="A Wordle board solving itself: famous openers, then the answer"
    >
      {rows.map((row, r) => (
        <div key={r} className="flex" style={{ gap: 'clamp(4px, 0.6vw, 7px)' }} aria-hidden="true">
          {row.letters.map((ch, c) => (
            <Tile
              key={c}
              letter={ch}
              state={row.states[c]}
              position={c}
              isFlipping={row.flipping}
              flipDelay={row.flipping ? c * 0.08 : 0}
              size="clamp(40px, 5.2vw, 60px)"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Marquee strip
// ---------------------------------------------------------------------------

const MARQUEE = ['entropy', 'skill', 'luck', 'bits', 'placement', 'season', 'hard mode'];

function Marquee() {
  const line = (key: string, hidden?: boolean) => (
    <span key={key} className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {MARQUEE.map((w) => (
        <span key={w} className="flex items-center font-mono text-label uppercase text-text-secondary">
          <span className="px-6 md:px-10">{w}</span>
          <span className="w-1.5 h-1.5 bg-accent" aria-hidden="true" />
        </span>
      ))}
    </span>
  );
  return (
    <div className="rule-top border-b border-border-subtle py-3 overflow-hidden">
      <div className="marquee flex w-max">
        {line('a')}
        {line('b', true)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/play');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-page">
        <TileSpinner size="lg" label="Loading" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto w-full px-4 md:px-8 pt-12 md:pt-20 pb-14 md:pb-24">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 items-center">
          <div className="md:col-span-7 min-w-0">
            <Label className="block mb-4">competitive wordle · season one</Label>
            <SplitWords text="Wordle, rated." as="h1" className="font-display text-display-xl text-text-primary" />
            <Reveal delay={0.25}>
              <p className="mt-6 md:mt-8 text-lg md:text-xl text-text-secondary max-w-md leading-snug">
                Every guess is scored in bits. Every game moves a rating. Then you review it like a chess player.
              </p>
            </Reveal>
            <Reveal delay={0.35} className="mt-8 md:mt-10 flex flex-wrap items-center gap-3">
              <ButtonLink href="/play" size="lg">
                Play today&apos;s word
                <ArrowRight size={15} />
              </ButtonLink>
              <ButtonLink href="/lab" size="lg" variant="secondary">
                Open the Lab
              </ButtonLink>
            </Reveal>
            <Reveal delay={0.45}>
              <p className="mt-6 text-sm text-text-secondary">
                Already rated?{' '}
                <Link href="/login" className="ink-link font-semibold text-text-primary">
                  Sign in
                </Link>
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.2} className="md:col-span-5 flex md:justify-end">
            <AutoBoard />
          </Reveal>
        </div>
      </section>

      {/* ── Marquee ── */}
      <Marquee />

      {/* ── Ochre wash band: the three things ── */}
      <section className="bg-wash-ochre">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-14 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-12 md:gap-y-16">
          <Reveal as="div" className="md:col-span-7 rule-top pt-4">
            <Label className="block mb-3">01 · competitive elo</Label>
            <h2 className="font-display text-display-md text-text-primary">
              Words have ratings too.
            </h2>
            <p className="mt-4 text-base text-text-secondary max-w-lg">
              Every answer carries an ELO learned from thousands of games. Beat a hard word quickly and your rating climbs; stumble on an easy one and it falls. Five placement games, then a season ladder.
            </p>
          </Reveal>

          <Reveal as="div" delay={0.1} className="md:col-span-5 rule-top pt-4">
            <Label className="block mb-3">02 · post-game review</Label>
            <h2 className="font-display text-display-md text-text-primary">
              See the move you missed.
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Each guess gets an accuracy score and a luck factor. Brilliant, book, mistake, blunder — the same language as a chess engine, applied to five letters.
            </p>
          </Reveal>

          <Reveal as="div" delay={0.15} className="md:col-span-12 rule-top pt-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <Label className="block mb-3">03 · opener lab</Label>
              <h2 className="font-display text-display-md text-text-primary">
                Measure your opener in bits.
              </h2>
              <p className="mt-4 text-base text-text-secondary max-w-lg">
                Type any word and see how it splits the answer list — expected remaining words, worst case, and the entropy it buys. No account needed.
              </p>
              <Link href="/lab" className="ink-link inline-flex items-center gap-1.5 mt-5 font-mono text-label uppercase text-text-primary">
                open the lab <ArrowRight size={12} />
              </Link>
            </div>

            {/* The one ink block on this page */}
            <div className="md:col-span-5 bg-bg-ink text-text-on-ink p-6 md:p-8 grid grid-cols-2 gap-6">
              <div>
                <Label className="block !text-text-on-ink opacity-60">best opener</Label>
                <div className="font-display font-black text-display-lg tabular mt-2 leading-none">
                  <CountUp value={5.88} decimals={2} />
                </div>
                <div className="font-mono text-xs mt-2 opacity-70">bits · SALET</div>
              </div>
              <div>
                <Label className="block !text-text-on-ink opacity-60">answers</Label>
                <div className="font-display font-black text-display-lg tabular mt-2 leading-none">
                  <CountUp value={2309} decimals={0} />
                </div>
                <div className="font-mono text-xs mt-2 opacity-70">in the pool</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Foot ── */}
      <section className="max-w-6xl mx-auto w-full px-4 md:px-8 py-14 md:py-20">
        <div className="rule-top pt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <p className="md:col-span-8 font-display text-display-md text-text-primary">
            One word a day. No account needed to start.
          </p>
          <div className="md:col-span-4 flex md:justify-end">
            <ButtonLink href="/play" size="lg">
              Play today&apos;s word
            </ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
