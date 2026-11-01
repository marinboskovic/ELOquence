'use client';
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Lock,
  Share2,
  MessageCircle,
  X,
} from 'lucide-react';
import CoachChat from '@/components/CoachChat';
import EloProjection from '@/components/EloProjection';
import Tile from '@/components/Tile';
import TileLoader from '@/components/TileLoader';
import { Button, Label, MiniTiles, PatternRow, SectionHead, Stat, Tag } from '@/components/ui';
import { gamesApi, analysisApi, communityApi, aiApi } from '@/lib/api';
import {
  Game,
  AnalysisResult,
  MoveAnalysis,
  PatternBucket,
  TopPick,
  patternToTiles,
} from '@/lib/types';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                  */
/* ------------------------------------------------------------------ */

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];

/**
 * Map a move classification to a CSS variable color.
 * Best/brilliant → blue, good → green, okay/book/forced → yellow,
 * inaccuracy/mistake → orange, blunder/miss → red.
 */
function classificationColor(c: string): string {
  switch (c) {
    case 'brilliant':
    case 'best':
      return 'var(--cls-blue)';
    case 'good':
      return 'var(--tile-correct)';
    case 'okay':
    case 'forced':
    case 'book':
      return 'var(--tile-present)';
    case 'inaccuracy':
    case 'mistake':
      return 'var(--cls-orange)';
    case 'blunder':
    case 'miss':
      return 'var(--cls-red)';
    default:
      return 'var(--text-tertiary)';
  }
}

/** Tag tone for a classification: green = good, ochre = meh, accent = bad. */
function classificationTone(c: string): 'green' | 'ochre' | 'accent' | 'neutral' {
  switch (c) {
    case 'brilliant':
    case 'best':
    case 'good':
      return 'green';
    case 'okay':
    case 'forced':
    case 'book':
    case 'inaccuracy':
      return 'ochre';
    case 'mistake':
    case 'blunder':
    case 'miss':
      return 'accent';
    default:
      return 'neutral';
  }
}

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

function infoPct(m: MoveAnalysis): number {
  if (m.pattern === 242) return 100;
  const gained = m.info_gained ?? 0;
  const optimal = m.optimal_info ?? 0;
  return Math.min(100, Math.round((gained / Math.max(optimal, 0.0001)) * 100));
}

/**
 * Probability, before the pattern was revealed, that the guessed word was
 * actually the solution. If the word isn't one of the remaining candidate
 * answers it can't possibly be the solution, so we return 0% (not "—").
 */
function probWasSolution(
  guessWord: string,
  targetWord: string | null,
  remainingBefore: number,
  remainingWordsList?: string[],
): string {
  if (!guessWord) return '—';
  if (guessWord === targetWord) return '100%';
  if (remainingWordsList && remainingWordsList.length > 0) {
    if (remainingWordsList.includes(guessWord)) {
      return `${Math.round(100 / Math.max(1, remainingBefore))}%`;
    }
    return '0%';
  }
  return '—';
}

function highlightPair(
  yourVal: number | null,
  botVal: number | null,
  direction: 'lower' | 'higher',
): [boolean, boolean] {
  if (yourVal === null && botVal === null) return [false, false];
  if (yourVal === null) return [false, true];
  if (botVal === null) return [true, false];
  const eps = 0.001;
  if (Math.abs(yourVal - botVal) < eps) return [true, true];
  if (direction === 'lower') {
    return yourVal < botVal ? [true, false] : [false, true];
  }
  return yourVal > botVal ? [true, false] : [false, true];
}

function buildCommentary(m: MoveAnalysis, optimalWord: string): string {
  const skill = m.skill_score ?? 0;
  const isOpener = m.move_number === 1;
  const isSolving = m.pattern === 242;
  const isForced = m.classification === 'forced';
  const pct = infoPct(m);
  const exactMatch = m.guess_word === optimalWord;
  // "Tied" = info gain is within 1% of optimal but the word itself differs.
  // This is the multiple-best-picks case (e.g. CRONY vs DRAIN both ~6.3 bits).
  const tiedWithBot = !exactMatch && pct >= 99;

  const suffix = isSolving ? ' Puzzle solved.' : '';
  const violationNote =
    m.constraint_violation && m.constraint_violation !== 'none'
      ? ' Note: this didn’t reuse a revealed hint.'
      : '';

  if (isForced) return 'Only one word left — locked in.';

  if (isOpener) {
    if (skill >= 90) {
      return `Strong opener — sets up the rest of the game well.`;
    }
    if (skill >= 75) {
      return `Reasonable opener, though ${optimalWord} splits the field slightly better.`;
    }
    return `Weak opener — ${optimalWord} would have given more information up front.`;
  }

  if (skill >= 95 && exactMatch) {
    return `Excellent work — I’d have played this exact word.${suffix}${violationNote}`;
  }
  if (skill >= 95 && tiedWithBot) {
    return `Tied with my pick — your ${m.guess_word} and ${optimalWord} extract essentially the same information. My tiebreaker landed on ${optimalWord}.${suffix}${violationNote}`;
  }
  if (skill >= 95) {
    return `Solid choice. Mine was ${optimalWord} but yours is essentially as good.${suffix}${violationNote}`;
  }
  if (skill >= 80) {
    return `Good guess — ${optimalWord} would have been slightly sharper.${suffix}${violationNote}`;
  }
  if (skill >= 60) {
    return `Decent guess, but ${optimalWord} would have narrowed things down faster.${suffix}${violationNote}`;
  }
  if (skill >= 30) {
    return `This one missed some easy information — I’d have played ${optimalWord}.${suffix}${violationNote}`;
  }
  return `Tough call. ${optimalWord} would have eliminated far more candidates.${suffix}${violationNote}`;
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                             */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton bg-bg-muted', className)} />;
}

/* ------------------------------------------------------------------ */
/* Metric chip                                                          */
/* ------------------------------------------------------------------ */

function Chip({
  value,
  highlighted,
}: {
  value: string;
  highlighted: boolean;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center px-2 h-7 font-mono font-semibold tabular text-sm min-w-[56px] border',
        highlighted ? 'bg-wash-green border-transparent text-text-primary' : 'bg-transparent border-border-subtle text-text-primary'
      )}
    >
      {value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Navigator grid (6×5 mini tiles, clickable rows)                     */
/* ------------------------------------------------------------------ */

function NavigatorGrid({
  guesses,
  patterns,
  activeRow,
  onRowClick,
}: {
  guesses: string[];
  patterns: number[];
  activeRow: number;
  onRowClick: (row: number) => void;
}) {
  return (
    <div className="flex flex-col gap-[3px]" role="list" aria-label="Guess navigator">
      {Array.from({ length: 6 }).map((_, row) => {
        const guess = guesses[row] || '';
        const pat = patterns[row] !== undefined ? patterns[row] : null;
        const tiles = pat !== null ? patternToTiles(pat) : null;
        const isActive = row === activeRow;
        const hasGuess = !!guess;
        const states = tiles
          ? (tiles as ('correct' | 'present' | 'absent' | 'empty')[])
          : Array.from({ length: 5 }, () => 'empty' as const);

        return (
          <button
            key={row}
            type="button"
            role="listitem"
            disabled={!hasGuess}
            onClick={() => hasGuess && onRowClick(row)}
            aria-label={hasGuess ? `Go to move ${row + 1}` : `Empty row ${row + 1}`}
            aria-current={isActive ? 'true' : undefined}
            className={clsx(
              'flex items-center gap-2 p-0 border-0 bg-transparent transition-opacity duration-fast',
              hasGuess ? 'cursor-pointer' : 'cursor-default',
              hasGuess && !isActive && 'opacity-50 hover:opacity-100'
            )}
          >
            <span className={clsx('block w-[2px] h-5', isActive ? 'bg-accent' : 'bg-transparent')} aria-hidden="true" />
            <MiniTiles word={hasGuess ? guess : '     '} states={states} size={22} gap={3} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stats table                                                          */
/* ------------------------------------------------------------------ */

function StatsTable({
  moves,
  activeRow,
}: {
  moves: MoveAnalysis[];
  activeRow: number;
}) {
  const COLS = '2.5rem repeat(4, 1fr)';
  return (
    <div className="w-full min-w-0">
      <div className="rule-top grid gap-x-2 sm:gap-x-4 pt-2 pb-1.5" style={{ gridTemplateColumns: COLS }}>
        <Label>#</Label>
        {[
          { full: 'skill', short: 'skill' },
          { full: 'luck', short: 'luck' },
          { full: 'words left', short: 'left' },
          { full: 'info (bits)', short: 'bits' },
        ].map((h) => (
          <Label key={h.full} className="text-right">
            <span className="sm:hidden">{h.short}</span>
            <span className="hidden sm:inline">{h.full}</span>
          </Label>
        ))}
      </div>
      <div className="flex flex-col">
        {moves.map((m, i) => {
          const isActive = i === activeRow;
          const bitsGained = m.info_gained ?? 0;
          const wordsLeft = m.pattern === 242 ? '—' : String(m.remaining_after ?? '—');
          return (
            <div
              key={i}
              className={clsx(
                'grid gap-x-2 sm:gap-x-4 py-1.5 border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast',
                isActive && 'bg-bg-elevated'
              )}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className={clsx('font-mono text-xs tabular', isActive ? 'text-accent' : 'text-text-tertiary')}>{i + 1}</span>
              {[
                String(m.skill_score ?? '—'),
                String(m.luck_score ?? '—'),
                wordsLeft,
                bitsGained.toFixed(1),
              ].map((val, j) => (
                <span key={j} className="font-mono font-semibold tabular text-sm text-right text-text-primary">
                  {val}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MY PICKS expandable                                                  */
/* ------------------------------------------------------------------ */

function BotPicksExpand({
  picks,
  optimalWord,
}: {
  picks: TopPick[];
  optimalWord: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = picks
    .filter((p) => p.word !== optimalWord)
    .slice(0, 5);

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        <Check size={15} style={{ color: 'var(--tile-correct)', flexShrink: 0 }} aria-hidden="true" />
        <span className="font-display font-bold text-xl uppercase tracking-wide text-text-primary">{optimalWord}</span>
        <span className="font-mono font-semibold text-lg tabular text-text-primary">99</span>
        {filtered.length > 0 && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-1 w-6 h-6 inline-flex items-center justify-center text-text-secondary hover:text-text-primary"
            aria-expanded={open}
            aria-label="Show alternative picks"
          >
            <ChevronDown
              size={16}
              style={{
                transform: open ? 'rotate(180deg)' : 'none',
                transition: 'transform var(--dur-fast)',
              }}
            />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && filtered.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2 flex flex-col">
              {filtered.map((p, i) => (
                <div key={i} className="rule-hair py-1.5 flex items-center gap-3 text-sm">
                  <span className="font-display font-bold uppercase tracking-wide text-text-secondary" style={{ minWidth: 56 }}>{p.word}</span>
                  <span className="font-mono text-xs tabular text-text-tertiary">~{p.expected_remaining.toFixed(1)} exp.</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metric matrix row                                                    */
/* ------------------------------------------------------------------ */

type MetricRowData = {
  your: string;
  bot: string;
  label: React.ReactNode;
  yH: boolean;
  bH: boolean;
};

function MetricMatrix({ rows }: { rows: MetricRowData[] }) {
  return (
    <div className="flex flex-col">
      <div className="grid items-center gap-3 pb-1.5 border-b border-border-subtle" style={{ gridTemplateColumns: '64px 1fr 64px' }}>
        <Label className="text-center">you</Label>
        <span />
        <Label className="text-center">bot</Label>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid items-center gap-3 py-2 border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast"
          style={{ gridTemplateColumns: '64px 1fr 64px' }}
        >
          <div className="flex justify-center">
            <Chip value={r.your} highlighted={r.yH} />
          </div>
          <p className="font-sans text-[13px] text-center leading-tight text-text-secondary">{r.label}</p>
          <div className="flex justify-center">
            <Chip value={r.bot} highlighted={r.bH} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pattern group panel                                                  */
/* ------------------------------------------------------------------ */

function PatternGroupPanel({
  label,
  buckets,
  totalRemaining,
}: {
  label: string;
  buckets: PatternBucket[];
  totalRemaining: number;
}) {
  // Top 3 by count, plus the bucket that contains the actual solution
  // (appended only when it's not already among the top 3 so the user
  // can always see where the answer landed).
  const sorted = [...buckets].sort((a, b) => b.count - a.count);
  const top3 = sorted.slice(0, 3);
  const actualBucket = sorted.find((b) => b.is_actual);
  const actualOutsideTop3 =
    actualBucket && !top3.includes(actualBucket) ? actualBucket : null;

  type Row = { bucket: PatternBucket; isExtra: boolean };
  const rows: Row[] = [
    ...top3.map((b) => ({ bucket: b, isExtra: false })),
    ...(actualOutsideTop3 ? [{ bucket: actualOutsideTop3, isExtra: true }] : []),
  ];

  return (
    <div className="flex-1 min-w-0">
      <Label className="block mb-3">{label}</Label>
      <div className="flex flex-col gap-4">
        {rows.map(({ bucket, isExtra }, i) => {
          const pct =
            totalRemaining > 0
              ? Math.round((bucket.count / totalRemaining) * 100)
              : Math.round((bucket.probability ?? 0) * 100);
          const repWord = bucket.words?.[0] ?? '—';
          const labelText = bucket.is_actual
            ? 'Group with the solution'
            : 'Chance solution is among these words';
          const barColor = bucket.is_actual ? 'var(--tile-correct)' : 'var(--border-default)';

          return (
            <div
              key={`${bucket.pattern}-${i}`}
              className={clsx('flex flex-col gap-1.5', isExtra && 'rule-hair pt-3')}
            >
              {isExtra && <Label className="mb-1 text-text-primary">where the answer landed</Label>}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">pattern</span>
                  <PatternRow pattern={bucket.pattern} size={14} gap={2} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-mono text-[10px] text-text-tertiary">e.g.</span>
                  <span className={clsx('font-display font-bold text-sm uppercase', bucket.is_actual ? 'text-text-primary' : 'text-text-secondary')}>
                    {repWord}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-right leading-tight text-text-tertiary" style={{ maxWidth: 88 }}>
                    {labelText}
                  </span>
                  <span className="font-mono font-semibold tabular text-base text-text-primary">{pct}%</span>
                </div>
              </div>
              <div className="w-full relative" style={{ height: 2 }}>
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-border-subtle" style={{ height: 1 }} aria-hidden="true" />
                <motion.div
                  className="absolute inset-y-0 left-0 w-full origin-left"
                  style={{ backgroundColor: barColor }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.2, 0.8, 0.2, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-guess card                                                       */
/* ------------------------------------------------------------------ */

function GuessCard({
  move,
  moveIndex,
  activeRow,
  targetWord,
  gameId,
  aiCacheRef,
}: {
  move: MoveAnalysis;
  moveIndex: number;
  activeRow: number;
  targetWord: string | null;
  gameId: string | null;
  aiCacheRef: { current: Map<number, string> };
}) {
  const n = move.move_number;
  // AI-written per-move commentary. Falls back to the rule-based commentary
  // (`buildCommentary`) if the LLM is unavailable or the request fails.
  // Cache lives on the page so flipping between slides doesn't re-hit Gemini.
  const cachedAi = aiCacheRef.current.get(n) ?? null;
  const [aiCommentary, setAiCommentary] = useState<string | null>(cachedAi);
  const [aiCommentaryLoading, setAiCommentaryLoading] = useState(!cachedAi && !!gameId);

  useEffect(() => {
    if (!gameId) {
      setAiCommentaryLoading(false);
      return;
    }
    if (aiCacheRef.current.has(n)) {
      setAiCommentary(aiCacheRef.current.get(n)!);
      setAiCommentaryLoading(false);
      return;
    }
    let cancelled = false;
    setAiCommentaryLoading(true);
    aiApi
      .explainMove(gameId, n)
      .then((res) => {
        const text = (res.data as { explanation: string }).explanation;
        aiCacheRef.current.set(n, text);
        if (!cancelled) setAiCommentary(text);
      })
      .catch(() => {
        /* leave aiCommentary null; the render path falls back to buildCommentary */
      })
      .finally(() => {
        if (!cancelled) setAiCommentaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, n, aiCacheRef]);
  const isSolving = move.pattern === 242;
  const optimalWord = move.optimal_word ?? move.bot_pick ?? '—';
  const skill = move.skill_score ?? 0;
  const remainBefore = move.remaining_before ?? move.remaining_words ?? 1;
  const picks: TopPick[] = move.top_picks?.length
    ? move.top_picks
    : move.candidates_top_n ?? [];
  const pDist: PatternBucket[] = move.pattern_distribution ?? [];

  const yourExpRem = move.expected_remaining ?? move.expected_solutions_after ?? null;
  const botExpRem = move.optimal_expected_remaining ?? null;
  const yourActual = move.actual_solutions_after ?? null;
  const yourExpSteps = move.expected_steps_until_solution ?? null;

  const yourSolChance = probWasSolution(
    move.guess_word,
    targetWord,
    remainBefore,
    move.remaining_words_list,
  );
  const botSolChance = probWasSolution(
    optimalWord === '—' ? '' : optimalWord,
    targetWord,
    remainBefore,
    move.remaining_words_list,
  );

  const botActualSolutionsAfter = move.optimal_actual_solutions_after ?? null;
  const botExpStepsUntilSolution =
    move.optimal_expected_steps_until_solution ?? null;

  const [expRemH, botExpRemH] = highlightPair(yourExpRem, botExpRem, 'lower');
  const [actualH, botActualH] = highlightPair(
    yourActual,
    botActualSolutionsAfter,
    'lower',
  );
  const yourSolNum =
    yourSolChance === '—' ? null : parseInt(yourSolChance.replace('%', ''));
  const botSolNum =
    botSolChance === '—' ? null : parseInt(botSolChance.replace('%', ''));
  const [solH, botSolH] = highlightPair(yourSolNum, botSolNum, 'higher');
  const [stepsH, botStepsH] = highlightPair(
    yourExpSteps,
    botExpStepsUntilSolution,
    'lower',
  );

  const numGroups = pDist.length;
  const largestGroup =
    pDist.length > 0 ? Math.max(...pDist.map((b) => b.count)) : null;
  const infoGained = move.info_gained ?? 0;
  const optimalInfo = move.optimal_info ?? 0;

  const botPDist: PatternBucket[] = move.optimal_pattern_distribution ?? [];
  const botNumGroups = move.optimal_num_groups ?? (botPDist.length || null);
  const botLargestGroup =
    move.optimal_largest_group ??
    (botPDist.length > 0 ? Math.max(...botPDist.map((b) => b.count)) : null);

  const [groupsH, botGroupsH] = highlightPair(numGroups, botNumGroups, 'higher');
  const [largestH, botLargestH] = highlightPair(largestGroup, botLargestGroup, 'lower');
  const [bitsH, botBitsH] = highlightPair(infoGained, optimalInfo, 'higher');
  const classColor = move.classification ? classificationColor(move.classification) : 'var(--text-tertiary)';
  const classTone = move.classification ? classificationTone(move.classification) : 'neutral';
  const statusIcon: React.ReactNode =
    move.classification === 'forced'
      ? <Lock size={15} style={{ color: classColor, flexShrink: 0 }} aria-hidden="true" />
      : move.classification === 'brilliant' || move.classification === 'best'
      ? <Check size={15} style={{ color: classColor, flexShrink: 0 }} aria-hidden="true" />
      : null;
  const guessTiles = patternToTiles(move.pattern).map((t) => (t === 'tbd' ? 'empty' : t));

  return (
    <section id={`guess-${n}`} data-guess={n} className="pt-2">
      <div className="rule-top pt-3 flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <Label className="block mb-1">move {n}</Label>
          <h2 className="font-display text-display-md text-text-primary">Your {ordinal(n)} Guess</h2>
        </div>
        <MiniTiles word={move.guess_word} states={guessTiles} size={26} />
      </div>

      <>
          {/* Comparison row */}
          <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-6 mb-5">
            <div className="rule-hair pt-3 min-w-0">
              <Label className="block mb-2">your guess</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {statusIcon}
                <span className="font-display font-bold text-xl uppercase tracking-wide text-text-primary">{move.guess_word}</span>
                <span className="font-mono font-semibold text-lg tabular text-text-primary">{skill}</span>
                {move.classification && <Tag tone={classTone}>{move.classification}</Tag>}
              </div>
            </div>

            <div className="rule-hair pt-3 min-w-0">
              <Label className="block mb-2">my picks</Label>
              {optimalWord === '—' ? (
                <span className="font-display font-bold text-xl text-text-tertiary">—</span>
              ) : (
                <BotPicksExpand picks={picks} optimalWord={optimalWord} />
              )}
            </div>
          </div>

          {aiCommentaryLoading ? (
            <div className="mb-6 flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-[85%]" />
            </div>
          ) : (
            <p className="font-sans text-[15px] leading-relaxed mb-6 text-text-secondary">
              {aiCommentary || buildCommentary(move, optimalWord)}
            </p>
          )}

          {/* Solved variant — skip metrics/groups */}
          {isSolving ? (
            <div className="flex items-center gap-4 py-5 px-5 bg-wash-green flex-wrap">
              <MiniTiles word={move.guess_word} states={['correct', 'correct', 'correct', 'correct', 'correct']} size={26} />
              <span className="font-display text-display-sm text-text-primary">Puzzle solved in {n}/6.</span>
            </div>
          ) : (
            <>
              {/* Metrics matrix */}
              <div className="rule-top pt-4 mt-8">
                <Label className="block mb-4">comparing our guesses</Label>

                <div className="mb-3">
                  <MetricMatrix rows={[
                    { your: yourExpRem != null ? yourExpRem.toFixed(1) : '—', bot: botExpRem != null ? botExpRem.toFixed(1) : '—', label: 'Expected solutions after guess', yH: expRemH, bH: botExpRemH },
                    { your: yourActual != null ? String(yourActual) : '—', bot: botActualSolutionsAfter != null ? String(botActualSolutionsAfter) : '—', label: 'Actual solutions after guess', yH: actualH, bH: botActualH },
                    // "Est. chance guess was solution" is only meaningful when at least
                    // one side's word is in the answer pool. Both 0% (info-only probes
                    // like SALET/TARES) adds no insight, so hide it in that case.
                    ...((yourSolChance === '0%' || yourSolChance === '—') &&
                       (botSolChance === '0%' || botSolChance === '—')
                      ? []
                      : [{ your: yourSolChance, bot: botSolChance, label: 'Est. chance guess was solution', yH: solH, bH: botSolH }]),
                    { your: yourExpSteps != null ? yourExpSteps.toFixed(2) : '—', bot: botExpStepsUntilSolution != null ? botExpStepsUntilSolution.toFixed(2) : '—', label: 'Expected steps until solution', yH: stepsH, bH: botStepsH },
                  ]} />
                </div>

                <p className="font-sans text-xs text-text-tertiary flex items-center gap-1.5 flex-wrap">
                  Better outcomes are <Chip value="highlighted" highlighted={true} />.
                </p>
              </div>

              {/* Pattern groups */}
              {pDist.length > 0 && (
                <div className="rule-top pt-4 mt-8">
                  <p className="font-sans text-[15px] leading-relaxed mb-5 text-text-secondary">
                    Here&rsquo;s how our guesses divided the{' '}
                    <strong className="text-text-primary font-semibold">{remainBefore} solutions</strong>{' '}
                    that I think remained before your guess. (On average, more
                    and smaller groups mean faster solving.)
                  </p>

                  <div className="mb-6">
                    <MetricMatrix rows={[
                      { your: String(numGroups), bot: botNumGroups != null ? String(botNumGroups) : '—', label: 'Number of groups', yH: groupsH, bH: botGroupsH },
                      { your: largestGroup != null ? String(largestGroup) : '—', bot: botLargestGroup != null ? String(botLargestGroup) : '—', label: 'Largest group', yH: largestH, bH: botLargestH },
                      { your: infoGained.toFixed(2), bot: optimalInfo > 0 ? optimalInfo.toFixed(2) : '—', label: <>Bits of <a href="/faq#strategy-math" className="ink-link text-text-primary">information</a></>, yH: bitsH, bH: botBitsH },
                    ]} />
                  </div>

                  <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-6">
                    <PatternGroupPanel
                      label={`Your Groups, with ${move.guess_word}`}
                      buckets={pDist}
                      totalRemaining={remainBefore}
                    />
                    {botPDist.length > 0 ? (
                      <PatternGroupPanel
                        label={`My Groups, with ${optimalWord}`}
                        buckets={botPDist}
                        totalRemaining={remainBefore}
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <Label className="block mb-3">{`My Groups, with ${optimalWord}`}</Label>
                        <p className="font-sans text-sm text-text-tertiary">My groups not available for this analysis.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Community panel                                                      */
/* ------------------------------------------------------------------ */

interface WordStats {
  word: string;
  times_played: number;
  times_solved: number;
  solve_rate: number;
  avg_guesses: number | null;
  avg_accuracy: number | null;
  difficulty: number | null;
}

function CommunityPanel({
  gameId,
  targetWord,
  playerGuesses,
}: {
  gameId: string;
  targetWord: string | null;
  playerGuesses: number;
}) {
  const [stats, setStats] = useState<WordStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi
      .gameStats(gameId)
      .then((res: { data: WordStats }) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return (
      <section className="rule-top pt-6 mt-10">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-24" />
      </section>
    );
  }

  if (!stats) return null;

  const hasData = stats.times_played > 0;
  const delta =
    hasData && stats.avg_guesses != null
      ? playerGuesses - stats.avg_guesses
      : null;
  const beatAvg = delta != null && delta < 0;

  return (
    <section className="mt-6">
      <SectionHead eyebrow="community" title={<>How others did with {targetWord ?? 'this word'}</>} />
      <p className="font-sans text-sm leading-relaxed text-text-secondary mt-3 mb-6">
        {hasData
          ? `${stats.times_played.toLocaleString()} other ELOquence players have faced this word.`
          : 'No one else has played this word yet — stats will appear as others solve it.'}
      </p>

      {hasData && (
        <div className="grid grid-cols-2 gap-x-6 mb-4 max-w-md">
          <Stat label="solve rate" value={`${Math.round(stats.solve_rate)}%`} />
          <Stat
            label="community avg"
            value={stats.avg_guesses != null ? stats.avg_guesses.toFixed(1) : '—'}
            sub={
              delta != null ? (
                <span className={clsx('font-mono tabular', beatAvg ? 'text-text-primary font-semibold' : 'text-text-tertiary')}>
                  you: {playerGuesses} ({delta > 0 ? '+' : ''}
                  {delta.toFixed(1)} vs avg)
                </span>
              ) : undefined
            }
          />
        </div>
      )}

      {hasData && (
        <p className="font-sans text-xs text-text-tertiary">As more players solve this word, this card gets richer.</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Floating Coach FAB + slide-in panel                                 */
/* ------------------------------------------------------------------ */

function CoachFab({
  gameId,
  gameContext,
}: {
  gameId: string;
  gameContext: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 flex flex-col items-center justify-center gap-1 bg-bg-ink text-text-on-ink border-2 border-border-default hover:shadow-ink hover:-translate-x-0.5 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-fast"
        whileTap={{ scale: 0.97 }}
        aria-label="Open coach"
      >
        <MessageCircle size={18} aria-hidden="true" />
        <span className="font-mono text-[10px] uppercase tracking-[0.14em]">coach</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 md:hidden"
              style={{ backgroundColor: 'var(--dialog-backdrop)' }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              key="panel"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed z-40 flex flex-col bg-bg-elevated border-2 border-border-default shadow-ink"
              style={{ top: 'calc(var(--nav-h) + 16px)', right: 16, bottom: 16, width: 'calc(100% - 32px)', maxWidth: 380 }}
              role="dialog"
              aria-label="Coach"
            >
              <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b-2 border-border-default">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
                  <span className="font-display font-bold text-base text-text-primary">Coach</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 inline-flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors duration-fast"
                  aria-label="Close coach"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CoachChat gameId={gameId} gameContext={gameContext} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Step panels                                                         */
/* ------------------------------------------------------------------ */

function StepOverview({
  analysis,
  activeRow,
  showExplanation,
  setShowExplanation,
  game,
  guesses,
  patterns,
  onRowClick,
}: {
  analysis: AnalysisResult;
  activeRow: number;
  showExplanation: boolean;
  setShowExplanation: (fn: (v: boolean) => boolean) => void;
  game: Game | null;
  guesses: string[];
  patterns: number[];
  onRowClick: (row: number) => void;
}) {
  const won = game?.status === 'won';
  const lost = game?.status === 'lost';
  const skill = Math.round(analysis.skill_avg ?? analysis.skill_avg_excluding_opener ?? 0);
  const luck = Math.round(analysis.luck_avg ?? 0);
  const openerSub =
    (analysis.opener_total_games ?? 0) > 1 ? `${analysis.opener_rarity_pct ?? 0}% chose differently` : 'first play of this opener';

  return (
    <div className="pt-2">
      {/* Editorial spread: word + result left, the real board right */}
      <div className="grid md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-7 flex flex-col gap-4">
          <h1 className="font-display text-display-lg text-text-primary uppercase break-words">{game?.target_word ?? '—'}</h1>
          <p className="font-display text-display-sm text-text-primary">
            {won ? `Won in ${game!.num_guesses}` : lost ? 'Not solved' : '—'}
          </p>
          <div className="flex flex-col gap-1 font-mono text-xs text-text-secondary tabular">
            <span>{game?.mode ?? '—'}{game?.rated ? ' · rated' : ''}</span>
            {game?.created_at && (
              <span>{new Date(game.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            )}
            {game?.word_difficulty != null && <span>word elo {Math.round(game.word_difficulty)}</span>}
            {game?.elo_delta != null && game.elo_delta !== 0 && (
              <span className="text-text-primary font-semibold">
                {game.elo_delta > 0 ? '+' : ''}
                {Math.round(game.elo_delta)} elo
              </span>
            )}
          </div>
        </div>
        <div className="md:col-span-5 flex md:justify-end">
          <div role="grid" aria-label="Game board" className="flex flex-col" style={{ gap: 'var(--tile-gap)' }}>
            {Array.from({ length: 6 }).map((_, row) => {
              const guess = guesses[row] || '';
              const tiles = patterns[row] !== undefined ? patternToTiles(patterns[row]) : null;
              const hasGuess = !!guess;
              return (
                <div
                  key={row}
                  role="row"
                  onClick={() => hasGuess && onRowClick(row)}
                  className={clsx('flex', hasGuess && 'cursor-pointer')}
                  style={{ gap: 'var(--tile-gap)' }}
                  title={hasGuess ? `Open move ${row + 1}` : undefined}
                >
                  {Array.from({ length: 5 }).map((_, col) => (
                    <div key={col} role="gridcell">
                      <Tile letter={guess[col] ?? ''} state={tiles ? tiles[col] : 'empty'} position={col} size="clamp(36px, 5vw, 48px)" />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-6">
        <Stat label="skill" value={skill} size="lg" sub="your decisions" />
        <Stat label="luck" value={luck} size="lg" sub="your outcomes" />
        <Stat label="opener" value={analysis.opener_word || '—'} size="lg" sub={openerSub} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mt-10">
        <StatsTable moves={analysis.moves} activeRow={activeRow} />
      </div>

      <div className="mt-6">
        <p className="font-sans text-sm text-text-secondary mb-2">
          Decision quality vs. how the tiles fell — judged separately.
        </p>

        <button
          onClick={() => setShowExplanation((v) => !v)}
          className="ink-link font-mono text-label uppercase text-text-primary"
          aria-expanded={showExplanation}
        >
          {showExplanation ? 'show less' : 'show more'}
        </button>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden"
            >
              {/* ELO distribution — top of the disclosure so it's the
                  first thing the player sees when they open "Show more". */}
              {game && game.rated && game.accuracy_score != null && (
                <div className="mt-4">
                  <EloProjection game={game} accuracy={game.accuracy_score} />
                </div>
              )}

              <div className="mt-6 rule-top pt-4">
                <Label className="block mb-3">how to read the columns</Label>
                {[
                  {
                    term: 'Skill (0–99)',
                    def: 'How close your guess was to the bot’s best pick — judged before the tiles flip. 99 means you picked a word that would, on average, narrow things down as well as any other word. A low score doesn’t mean you played a bad word — it means there was a clearly better one available.',
                  },
                  {
                    term: 'Luck (50 = average)',
                    def: 'Whether the tiles flipped better or worse than your guess deserved. Above 50: the pattern eliminated more words than expected. Below 50: it eliminated fewer. Same guess, different answer → totally different luck score.',
                  },
                  {
                    term: 'Words left',
                    def: 'How many possible answer words were still in the running before this guess. Starts around 2,300 (full Wordle answer list) and shrinks as the colors narrow things down.',
                  },
                  {
                    term: 'Info gained',
                    def: 'How many bits of information this guess revealed. Each bit cuts the remaining possibilities in half — 1 bit ≈ half the words gone, 2 bits ≈ three-quarters gone, and so on. A strong guess gains several bits; a wasted guess gains almost none.',
                  },
                ].map(({ term, def }) => (
                  <p key={term} className="rule-hair py-3 font-sans text-sm leading-relaxed text-text-secondary">
                    <strong className="text-text-primary font-semibold">{term}</strong> &mdash; {def}
                  </p>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepFinal({
  game,
  analysis,
  router,
}: {
  game: Game | null;
  analysis: AnalysisResult;
  router: ReturnType<typeof useRouter>;
}) {
  void analysis;
  return (
    <div>
      {game && game.status !== 'in_progress' && game.user_id && (
        <CommunityPanel
          gameId={game.id}
          targetWord={game.target_word}
          playerGuesses={game.num_guesses}
        />
      )}
      <footer className="rule-top pt-6 mt-10 pb-6 flex flex-col gap-3 items-start">
        <Button variant="primary" onClick={() => router.push('/play')}>
          <ArrowLeft size={14} aria-hidden="true" />
          Back to play
        </Button>
      </footer>
    </div>
  );
}

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stepper navigation. Steps:
  //   0           — Overview (NavigatorGrid + StatsTable + summary banner)
  //   1..N        — One per move (GuessCard)
  //   N+1         — Final (community + actions)
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  // Per-move AI commentary survives slide nav so flipping back to a guess
  // doesn't re-call Gemini. Keyed by move_number.
  const aiCacheRef = useRef<Map<number, string>>(new Map());
  const moveCount = analysis?.moves.length ?? 0;
  const totalSteps = moveCount > 0 ? moveCount + 2 : 1;
  // -1 = no row is "current" (e.g. on the Overview or Final step). Per-move
  // steps map to their move index. Used to highlight the active row in the
  // NavigatorGrid and the StatsTable.
  const activeRow =
    currentStep >= 1 && currentStep <= moveCount ? currentStep - 1 : -1;

  useEffect(() => {
    if (!id) return;
    gamesApi
      .get(id)
      .then((res: { data: Game }) => setGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router]);

  const runAnalysis = useCallback(async () => {
    if (!id) return;
    setLoadingAnalysis(true);
    setAnalysisError('');
    try {
      const res = await analysisApi.analyze(id);
      setAnalysis(res.data);
    } catch {
      setAnalysisError('Analysis failed. The service may be unavailable.');
    } finally {
      setLoadingAnalysis(false);
    }
  }, [id]);

  useEffect(() => {
    if (game && game.status !== 'in_progress') {
      runAnalysis();
    }
  }, [game, runAnalysis]);

  const goToStep = useCallback(
    (next: number) => {
      if (totalSteps <= 1) return;
      const clamped = Math.max(0, Math.min(totalSteps - 1, next));
      setCurrentStep((prev) => {
        if (clamped === prev) return prev;
        setStepDir(clamped > prev ? 1 : -1);
        return clamped;
      });
    },
    [totalSteps],
  );
  // Use functional setters so rapid presses don't stale-capture currentStep
  const goPrev = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      if (prev <= 0) return prev;
      setStepDir(-1);
      return prev - 1;
    });
  }, [totalSteps]);
  const goNext = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      if (prev >= totalSteps - 1) return prev;
      setStepDir(1);
      return prev + 1;
    });
  }, [totalSteps]);
  // Clicking a mini-tile row jumps to that move's step (offset by 1 — step 0 is overview)
  const goToMoveRow = useCallback((row: number) => goToStep(row + 1), [goToStep]);

  // Keyboard navigation — ignore when typing in an input/textarea/contenteditable
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStep(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToStep(totalSteps - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, goToStep, totalSteps]);

  // Clamp current step if the analysis arrives and we're somehow past the end
  useEffect(() => {
    if (currentStep > totalSteps - 1) setCurrentStep(totalSteps - 1);
  }, [totalSteps, currentStep]);

  function handleShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  const guesses = game?.moves
    ? [...game.moves].sort((a, b) => a.move_number - b.move_number).map((m) => m.guess_word)
    : [];
  const boardPatterns = game?.moves
    ? [...game.moves].sort((a, b) => a.move_number - b.move_number).map((m) => m.pattern)
    : [];

  const wonGame = game?.status === 'won';
  const lostGame = game?.status === 'lost';
  const eloDelta = game?.elo_delta ?? null;

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-page">
        <TileLoader size={22} />
      </div>
    );
  }

  const gameContext = game
    ? `Game: ${game.target_word ?? 'unknown'}, ${game.status} in ${game.num_guesses}/6, mode: ${game.mode}`
    : '';

  const resultStates: ('correct' | 'absent')[] = Array.from({ length: 5 }, () => (wonGame ? 'correct' : 'absent'));

  return (
    <div className="min-h-page bg-bg-base">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 h-[52px] bg-bg-base border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-full flex items-center gap-4">
          <button
            onClick={() => router.push('/play')}
            className="ink-link inline-flex items-center gap-1.5 font-mono text-label uppercase text-text-secondary hover:text-text-primary"
            aria-label="Back to play"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="hidden sm:inline">play</span>
          </button>

          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            {game?.target_word && <MiniTiles word={game.target_word} states={resultStates} size={22} />}
            <Tag tone={wonGame ? 'green' : lostGame ? 'accent' : 'neutral'}>
              {wonGame ? `won ${game.num_guesses}/6` : lostGame ? 'lost' : game?.status ?? ''}
            </Tag>
            {game?.mode && <Tag className="hidden sm:inline-flex">{game.mode}</Tag>}
          </div>

          <div className="relative">
            <button
              onClick={handleShare}
              className="ink-link inline-flex items-center gap-1.5 font-mono text-label uppercase text-text-secondary hover:text-text-primary"
              aria-label="Share"
            >
              <Share2 size={14} aria-hidden="true" />
              <span className="hidden sm:inline">share</span>
            </button>
            <AnimatePresence>
              {toastVisible && (
                <motion.span
                  key="toast"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap pointer-events-none bg-bg-ink text-text-on-ink"
                  style={{ zIndex: 99 }}
                >
                  link copied
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main column */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-6 relative">
        <div className="max-w-[760px] mx-auto">
          {/* Persistent header — eyebrow + meta, navigator on move steps */}
          <div className="pt-6 mb-4 flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="block mb-1">
                game review{game?.mode ? ` · ${game.mode}` : ''}
                {game?.created_at
                  ? ` · ${new Date(game.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : ''}
              </Label>
              <div className="flex items-center gap-3 flex-wrap font-mono text-xs text-text-secondary tabular">
                {currentStep !== 0 && (
                  <span className="font-display font-bold text-base text-text-primary uppercase tracking-wide">{game?.target_word ?? '—'}</span>
                )}
                <span>{wonGame ? `won in ${game!.num_guesses}/6` : lostGame ? 'not solved' : '—'}</span>
                {game?.word_difficulty != null && (
                  <span title="Difficulty rating of the solved word">
                    word elo <span className="text-text-primary font-semibold">{Math.round(game.word_difficulty)}</span>
                  </span>
                )}
                {eloDelta != null && eloDelta !== 0 && (
                  <Tag tone={eloDelta > 0 ? 'green' : 'accent'}>
                    {eloDelta > 0 ? '+' : ''}
                    {Math.round(eloDelta)} elo
                  </Tag>
                )}
              </div>
            </div>

            {/* Navigator — hidden on the Overview step, which shows the real board */}
            {analysis && !loadingAnalysis && currentStep !== 0 && (
              <div className="shrink-0">
                <NavigatorGrid guesses={guesses} patterns={boardPatterns} activeRow={activeRow} onRowClick={goToMoveRow} />
              </div>
            )}
          </div>

          {/* Analysis error */}
          {analysisError && (
            <div className="mt-6 bg-wash-accent px-5 py-5 flex flex-col gap-3 items-start">
              <p className="font-display text-display-sm text-text-primary">{analysisError}</p>
              <Button variant="secondary" size="sm" onClick={runAnalysis}>
                Retry
              </Button>
            </div>
          )}

          {/* Loading skeleton for analysis */}
          {loadingAnalysis && (
            <div className="mt-6 flex flex-col gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-16" />
            </div>
          )}

          {/* Step panels — internal scrolling so the page itself stays put */}
          {analysis && !loadingAnalysis && (
            <div className="relative" style={{ height: 'max(320px, calc(100dvh - 330px))' }}>
              {/* Anchored arrows — sit just outside the box, vertically centered with it */}
              {totalSteps > 1 && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goPrev}
                    disabled={currentStep === 0}
                    aria-label="Previous step (←)"
                    className="hidden lg:inline-flex absolute -left-24 top-1/2 -translate-y-1/2 z-10 w-11 h-11 !px-0 bg-bg-base disabled:opacity-0 disabled:pointer-events-none"
                  >
                    <ChevronLeft size={18} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={goNext}
                    disabled={currentStep === totalSteps - 1}
                    aria-label="Next step (→)"
                    className="hidden lg:inline-flex absolute -right-24 top-1/2 -translate-y-1/2 z-10 w-11 h-11 !px-0 bg-bg-base disabled:opacity-0 disabled:pointer-events-none"
                  >
                    <ChevronRight size={18} aria-hidden="true" />
                  </Button>
                </>
              )}

              <div className="overflow-x-hidden h-full">
                <AnimatePresence mode="wait" custom={stepDir}>
                  <motion.div
                    key={currentStep}
                    custom={stepDir}
                    initial={{ opacity: 0, x: stepDir > 0 ? 40 : -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: stepDir > 0 ? -40 : 40 }}
                    transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                    className="h-full overflow-y-auto pr-1"
                    style={{ scrollbarGutter: 'stable' }}
                  >
                    {currentStep === 0 && (
                      <StepOverview
                        analysis={analysis}
                        activeRow={activeRow}
                        showExplanation={showExplanation}
                        setShowExplanation={setShowExplanation}
                        game={game}
                        guesses={guesses}
                        patterns={boardPatterns}
                        onRowClick={goToMoveRow}
                      />
                    )}
                    {currentStep >= 1 && currentStep <= moveCount && (
                      <GuessCard
                        move={analysis.moves[currentStep - 1]}
                        moveIndex={currentStep - 1}
                        activeRow={activeRow}
                        targetWord={game?.target_word ?? null}
                        gameId={game?.id ?? null}
                        aiCacheRef={aiCacheRef}
                      />
                    )}
                    {currentStep === moveCount + 1 && <StepFinal game={game} analysis={analysis} router={router} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Step indicator — thin ink segments, the active one in accent */}
          {analysis && !loadingAnalysis && totalSteps > 1 && (
            <div className="mt-4 flex justify-center items-center gap-1" role="tablist" aria-label="Review steps">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const active = i === currentStep;
                const label = i === 0 ? 'Overview' : i === moveCount + 1 ? 'Final' : `Move ${i}`;
                return (
                  <button
                    key={i}
                    role="tab"
                    aria-selected={active}
                    aria-label={label}
                    onClick={() => goToStep(i)}
                    className="group min-w-6 min-h-6 flex items-center py-2.5 px-0.5"
                  >
                    <span
                      className={clsx(
                        'block h-[2px] transition-[background-color,width] duration-med ease-ink',
                        active ? 'w-8 bg-accent' : 'w-5 bg-border-subtle group-hover:bg-border-default'
                      )}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Step counter + arrow controls */}
          {analysis && !loadingAnalysis && totalSteps > 1 && (
            <div className="mt-1 flex items-center justify-center gap-4">
              <Button variant="secondary" size="sm" onClick={goPrev} disabled={currentStep === 0} aria-label="Previous step" className="w-9 !px-0">
                <ChevronLeft size={16} aria-hidden="true" />
              </Button>
              <span className="font-mono text-xs tabular text-text-tertiary select-none">
                {currentStep + 1} / {totalSteps}
              </span>
              <Button variant="secondary" size="sm" onClick={goNext} disabled={currentStep === totalSteps - 1} aria-label="Next step" className="w-9 !px-0">
                <ChevronRight size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Floating coach */}
      {game && analysis && <CoachFab gameId={game.id} gameContext={gameContext} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

export default function ReviewPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-page">
          <TileLoader size={22} />
        </div>
      }
    >
      <ReviewPage />
    </Suspense>
  );
}
