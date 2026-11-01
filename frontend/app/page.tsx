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
import { ButtonLink, CountUp, Label, MiniTiles, Reveal, SplitWords, Tag } from '@/components/ui';
import ShrinkStrip from '@/components/landing/ShrinkStrip';
import { MODES, MOVE_CLASS } from '@/lib/copy';
import { pulseApi, type Pulse } from '@/lib/api';

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
// Live pulse marquee — what is happening in the game right now.
// Falls back to the best-first-words facts until /pulse answers (or if it
// never does), so the strip is never empty. Same running strip as before;
// every item is a fact, and most of them change every day.
// ---------------------------------------------------------------------------

const OPENERS: [string, number][] = [
  ['SOARE', 62], ['ROATE', 60], ['RAISE', 61], ['SLATE', 71], ['CRANE', 79], ['TRACE', 74], ['ADIEU', 160],
];

type MiniState = 'correct' | 'present' | 'absent' | 'empty';
type PulseItem = { key: string; tiles?: string; tileStates?: MiniState[]; text: React.ReactNode; href: string };

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

function pulseItems(p: Pulse | null): PulseItem[] {
  const strong = (v: React.ReactNode) => <span className="text-text-primary font-semibold">{v}</span>;
  const items: PulseItem[] = [];
  if (p?.today_daily && p.today_daily.players === 0) {
    items.push({ key: 'daily0', text: <>today&apos;s word · {strong('nobody has solved it yet')} — be the first</>, href: '/play' });
  }
  if (p?.today_daily && p.today_daily.players > 0) {
    const d = p.today_daily;
    items.push({ key: 'daily', text: <>today&apos;s word · {strong(d.players.toLocaleString('en-US'))} {d.players === 1 ? 'player' : 'players'} so far</>, href: '/play' });
    if (d.avg_guesses != null) items.push({ key: 'avg', text: <>solved in {strong(d.avg_guesses)} guesses on average</>, href: '/play' });
    if (d.fastest_seconds != null) items.push({ key: 'fast', text: <>fastest solve today {strong(fmtTime(d.fastest_seconds))}</>, href: '/leaderboard' });
  }
  if (p?.hardest_this_week) {
    const h = p.hardest_this_week;
    items.push({ key: 'hard', tiles: h.word, text: <>hardest word this week · difficulty {strong(h.difficulty.toLocaleString('en-US'))} · solved by {strong(`${h.solve_rate}%`)}</>, href: `/lab?word=${h.word}` });
  }
  if (p?.easiest_this_week) {
    const e = p.easiest_this_week;
    items.push({ key: 'easy', tiles: e.word, tileStates: ['correct', 'correct', 'correct', 'correct', 'correct'], text: <>easiest this week · difficulty {strong(e.difficulty.toLocaleString('en-US'))}</>, href: `/lab?word=${e.word}` });
  }
  // Community — real people doing real things (public profiles only).
  const c = p?.community;
  if (c?.biggest_jump_24h) {
    const j = c.biggest_jump_24h;
    items.push({ key: 'jump', text: <>{strong(j.username)} gained {strong(`+${j.gain}`)} rating today{j.word_difficulty ? <> · beat a {strong(j.word_difficulty.toLocaleString('en-US'))} word in {j.guesses}</> : null}</>, href: `/u/${encodeURIComponent(j.username)}` });
  }
  if (c?.longest_streak) items.push({ key: 'streak', text: <>{strong(c.longest_streak.username)} is on a {strong(`${c.longest_streak.days}-day`)} daily streak</>, href: `/u/${encodeURIComponent(c.longest_streak.username)}` });
  if (c?.two_guess_hero) items.push({ key: 'two', text: <>{strong(c.two_guess_hero.username)} solved a word in {strong('2 guesses')} today</>, href: `/u/${encodeURIComponent(c.two_guess_hero.username)}` });
  if (c?.latest_achievement) items.push({ key: 'ach', text: <>{strong(c.latest_achievement.username)} just unlocked {strong(c.latest_achievement.name)}{c.achievements_24h > 1 ? <> · {c.achievements_24h.toLocaleString('en-US')} badges earned today</> : null}</>, href: '/achievements' });
  if (c?.popular_opener_24h) items.push({ key: 'popop', tiles: c.popular_opener_24h.word, text: <>most popular first word today · {strong(c.popular_opener_24h.count.toLocaleString('en-US'))} {c.popular_opener_24h.count === 1 ? 'player' : 'players'}</>, href: `/lab?word=${c.popular_opener_24h.word}` });
  if (c && c.hard_mode_wins_week > 0) items.push({ key: 'hardmode', text: <>{strong(c.hard_mode_wins_week.toLocaleString('en-US'))} {c.hard_mode_wins_week === 1 ? 'win' : 'wins'} in hard mode this week</>, href: '/faq#hardmode' });
  if (p?.season) {
    const s = p.season;
    if (s.leader) items.push({ key: 'leader', text: <>{s.name} season · {strong(s.leader.username)} leads with {strong(`+${s.leader.gain}`)}</>, href: '/leaderboard?tab=season' });
    else items.push({ key: 'noleader', text: <>{s.name} season · {strong('no leader yet')} — the first Ranked win takes it</>, href: '/leaderboard?tab=season' });
    items.push({ key: 'days', text: <>{strong(s.days_left)} {s.days_left === 1 ? 'day' : 'days'} left in the season</>, href: '/leaderboard?tab=season' });
  }
  if (p && p.games_24h > 0) items.push({ key: 'g24', text: <>{strong(p.games_24h.toLocaleString('en-US'))} {p.games_24h === 1 ? 'game' : 'games'} played in the last 24 hours</>, href: '/play' });
  if (p && p.players_total > 0) items.push({ key: 'players', text: <>{strong(p.players_total.toLocaleString('en-US'))} {p.players_total === 1 ? 'player' : 'players'} on the ladder</>, href: '/leaderboard' });
  // Always end with two first-word facts so the strip stays about the game, not only about numbers.
  for (const [w, left] of OPENERS.slice(0, items.length ? 2 : OPENERS.length)) {
    items.push({ key: `op-${w}`, tiles: w, text: <>{strong(w)} leaves {strong(left)} of 2,309 answers</>, href: `/lab?word=${w}` });
  }
  return items;
}

function PulseMarquee() {
  const [pulse, setPulse] = useState<Pulse | null>(null);
  useEffect(() => {
    let alive = true;
    pulseApi
      .get()
      .then((r) => alive && setPulse(r.data))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const items = pulseItems(pulse);
  const line = (key: string, hidden?: boolean) => (
    <span key={key} className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <Link key={it.key} href={it.href} className="flex items-center gap-3 px-6 md:px-9 no-underline hover:text-text-primary">
          {it.tiles && <MiniTiles word={it.tiles} states={it.tileStates ?? ['absent', 'absent', 'absent', 'absent', 'absent']} size={18} gap={2} />}
          <span className="font-mono text-label uppercase text-text-secondary whitespace-nowrap">{it.text}</span>
          <span className="w-1.5 h-1.5 bg-accent ml-3" aria-hidden="true" />
        </Link>
      ))}
    </span>
  );
  return (
    <div className="rule-top border-b border-border-subtle py-3 overflow-hidden group" aria-label="Live: what is happening in the game">
      <div className="marquee flex w-max" style={{ animationDuration: `${Math.max(24, items.length * 6)}s` }}>
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
            <Label className="block mb-4">free · one word a day · no account needed</Label>
            <SplitWords text="Wordle, with a coach." as="h1" className="font-display text-display-xl text-text-primary" />
            <Reveal delay={0.25}>
              <p className="mt-6 md:mt-8 text-lg md:text-xl text-text-secondary max-w-md leading-snug">
                Play the daily word. Then see which guess cost you — and what a stronger one was.
              </p>
            </Reveal>
            <Reveal delay={0.35} className="mt-8 md:mt-10 flex flex-wrap items-center gap-3">
              <ButtonLink href="/play" size="lg">
                Play today&apos;s word
                <ArrowRight size={15} />
              </ButtonLink>
              <ButtonLink href="/lab" size="lg" variant="secondary">
                Try a first word
              </ButtonLink>
            </Reveal>
            <Reveal delay={0.45}>
              <p className="mt-6 text-sm text-text-secondary">
                Have an account?{' '}
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

      {/* ── Running strip: best first words (links to the Word Lab) ── */}
      <PulseMarquee />

      {/* ── The idea, drawn: the list of answers shrinks with every guess ── */}
      <ShrinkStrip />

      {/* ── Ochre wash band: the three things ── */}
      <section className="bg-wash-ochre">
        <div className="max-w-6xl mx-auto w-full px-4 md:px-8 py-14 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-x-8 gap-y-12 md:gap-y-16">
          <Reveal as="div" className="md:col-span-12 rule-top pt-4 grid grid-cols-1 md:grid-cols-12 gap-8 items-end">
            <div className="md:col-span-7">
              <Label className="block mb-3">01 · after the game</Label>
              <h2 className="font-display text-display-md text-text-primary">
                See where you lost the word.
              </h2>
              <p className="mt-4 text-base text-text-secondary max-w-lg">
                When the game ends you get a review. Every guess gets a plain verdict, and next to the costly ones you see the word you could have played instead.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Example verdicts">
                <Tag tone="green">{MOVE_CLASS.best.label}</Tag>
                <Tag tone="neutral">{MOVE_CLASS.good.label}</Tag>
                <Tag tone="ochre">{MOVE_CLASS.mistake.label}</Tag>
                <span className="text-sm text-text-secondary ml-1">— that is the whole scale you need.</span>
              </div>
            </div>

            {/* The one ink block on this page */}
            <div className="md:col-span-5 bg-bg-ink text-text-on-ink p-6 md:p-8 [container-type:inline-size]">
              <Label className="block !text-text-on-ink opacity-60">best first word · SALET</Label>
              <div className="mt-4 grid grid-cols-2 gap-6">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">leaves about</div>
                  <div className="font-display font-black tabular mt-1 leading-none tracking-[-0.04em] text-[clamp(2rem,13cqi,4.5rem)] whitespace-nowrap">
                    <CountUp value={60} decimals={0} />
                  </div>
                  <div className="font-mono text-xs mt-2 opacity-70">answers to pick from</div>
                </div>
                <div className="min-w-0">
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">out of</div>
                  <div className="font-display font-black tabular mt-1 leading-none tracking-[-0.04em] text-[clamp(2rem,13cqi,4.5rem)] whitespace-nowrap">
                    <CountUp value={2309} decimals={0} />
                  </div>
                  <div className="font-mono text-xs mt-2 opacity-70">possible answers</div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal as="div" delay={0.1} className="md:col-span-7 rule-top pt-4">
            <Label className="block mb-3">02 · learn</Label>
            <h2 className="font-display text-display-md text-text-primary">
              Learn it in ten minutes.
            </h2>
            <p className="mt-4 text-base text-text-secondary max-w-lg">
              Short lessons on the three things that matter: picking a first word, using the colours, and knowing when to go for the answer. Each one ends with a word to try.
            </p>
            <Link href="/learn" className="ink-link inline-flex items-center gap-1.5 mt-5 font-mono text-label uppercase text-text-primary">
              start the first lesson <ArrowRight size={12} />
            </Link>
          </Reveal>

          <Reveal as="div" delay={0.15} className="md:col-span-5 rule-top pt-4">
            <Label className="block mb-3">03 · optional</Label>
            <h2 className="font-display text-display-md text-text-primary">
              A rating, if you want one.
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              {MODES.competitive.name} mode — {MODES.competitive.tagline} {MODES.daily.name} and {MODES.practice.name} stay free of it: play those as much as you like and nothing counts against you.
            </p>
          </Reveal>

          <p className="md:col-span-12 rule-hair pt-4 text-sm text-text-secondary">
            Curious? The numbers behind it (information theory) are one toggle away — Simple or Detailed, your choice, on every page.
          </p>
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
