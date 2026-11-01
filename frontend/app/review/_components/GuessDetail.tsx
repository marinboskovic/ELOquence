'use client';
/**
 * Detailed view: one step per guess — your word vs the engine's pick,
 * the comparison matrix and the pattern groups. This is the thesis layer;
 * every metric stays, with plain names and hints.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Lock } from 'lucide-react';
import clsx from 'clsx';
import { Hint, Label, MiniTiles, PatternRow } from '@/components/ui';
import { aiApi } from '@/lib/api';
import { fmtInt } from '@/lib/copy';
import { patternToTiles, type MoveAnalysis, type PatternBucket, type TopPick } from '@/lib/types';
import MoveTag from './MoveTag';
import { SOLVED_PATTERN } from './insights';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

function ordinal(n: number): string {
  return ORDINALS[n - 1] ?? `${n}th`;
}

/** Icon colour for a classification (CSS tokens only). */
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

function infoPct(m: MoveAnalysis): number {
  if (m.pattern === SOLVED_PATTERN) return 100;
  const gained = m.info_gained ?? 0;
  const optimal = m.optimal_info ?? 0;
  return Math.min(100, Math.round((gained / Math.max(optimal, 0.0001)) * 100));
}

/**
 * Probability, before the pattern was revealed, that the guessed word was
 * actually the solution. If the word isn't one of the remaining candidate
 * answers it can't possibly be the solution, so we return 0% (not "—").
 */
function probWasSolution(guessWord: string, targetWord: string | null, remainingBefore: number, remainingWordsList?: string[]): string {
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

function highlightPair(yourVal: number | null, botVal: number | null, direction: 'lower' | 'higher'): [boolean, boolean] {
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

/** Rule-based fallback commentary when the AI explanation is unavailable. */
function buildCommentary(m: MoveAnalysis, optimalWord: string): string {
  const skill = m.skill_score ?? 0;
  const isOpener = m.move_number === 1;
  const isSolving = m.pattern === SOLVED_PATTERN;
  const isForced = m.classification === 'forced';
  const pct = infoPct(m);
  const exactMatch = m.guess_word === optimalWord;
  // "Tied" = info gain is within 1% of optimal but the word itself differs.
  const tiedWithBot = !exactMatch && pct >= 99;

  const suffix = isSolving ? ' Puzzle solved.' : '';
  const violationNote =
    m.constraint_violation && m.constraint_violation !== 'none' ? ' Note: this didn’t reuse a clue you already had.' : '';

  if (isForced) return 'Only one word left — nothing else to try.';

  if (isOpener) {
    if (skill >= 90) return 'Strong first word — it sets up the rest of the game well.';
    if (skill >= 75) return `Reasonable first word, though ${optimalWord} splits the answers slightly better.`;
    return `Weak first word — ${optimalWord} would have ruled out more words up front.`;
  }

  if (skill >= 95 && exactMatch) return `Excellent — I’d have played this exact word.${suffix}${violationNote}`;
  if (skill >= 95 && tiedWithBot) {
    return `Tied with my pick — your ${m.guess_word} and ${optimalWord} narrow the list almost identically. My tiebreaker landed on ${optimalWord}.${suffix}${violationNote}`;
  }
  if (skill >= 95) return `Solid choice. Mine was ${optimalWord}, but yours is essentially as good.${suffix}${violationNote}`;
  if (skill >= 80) return `Good guess — ${optimalWord} would have been slightly sharper.${suffix}${violationNote}`;
  if (skill >= 60) return `Decent guess, but ${optimalWord} would have narrowed things down faster.${suffix}${violationNote}`;
  if (skill >= 30) return `This one missed some easy clues — I’d have played ${optimalWord}.${suffix}${violationNote}`;
  return `Tough one. ${optimalWord} would have ruled out far more words.${suffix}${violationNote}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton bg-bg-muted', className)} />;
}

/* ------------------------------------------------------------------ */
/* Metric chip                                                          */
/* ------------------------------------------------------------------ */

function Chip({ value, highlighted }: { value: string; highlighted: boolean }) {
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
/* Best picks expandable                                                */
/* ------------------------------------------------------------------ */

function BotPicksExpand({ picks, optimalWord }: { picks: TopPick[]; optimalWord: string }) {
  const [open, setOpen] = useState(false);
  const filtered = picks.filter((p) => p.word !== optimalWord).slice(0, 5);

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
            aria-label="Show other strong picks"
          >
            <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--dur-fast)' }} />
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
                  <span className="font-display font-bold uppercase tracking-wide text-text-secondary" style={{ minWidth: 56 }}>
                    {p.word}
                  </span>
                  <span className="font-mono text-xs tabular text-text-tertiary">~{p.expected_remaining.toFixed(1)} words left on average</span>
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
/* Metric matrix                                                        */
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
        <Label className="text-center">engine</Label>
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

function PatternGroupPanel({ label, buckets, totalRemaining }: { label: string; buckets: PatternBucket[]; totalRemaining: number }) {
  // Top 3 by count, plus the bucket that contains the actual solution
  // (appended only when it's not already among the top 3).
  const sorted = [...buckets].sort((a, b) => b.count - a.count);
  const top3 = sorted.slice(0, 3);
  const actualBucket = sorted.find((b) => b.is_actual);
  const actualOutsideTop3 = actualBucket && !top3.includes(actualBucket) ? actualBucket : null;

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
          const pct = totalRemaining > 0 ? Math.round((bucket.count / totalRemaining) * 100) : Math.round((bucket.probability ?? 0) * 100);
          const repWord = bucket.words?.[0] ?? '—';
          const labelText = bucket.is_actual ? 'Group with the answer' : 'Chance the answer is among these';
          const barColor = bucket.is_actual ? 'var(--tile-correct)' : 'var(--border-default)';

          return (
            <div key={`${bucket.pattern}-${i}`} className={clsx('flex flex-col gap-1.5', isExtra && 'rule-hair pt-3')}>
              {isExtra && <Label className="mb-1 text-text-primary">where the answer landed</Label>}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">pattern</span>
                  <PatternRow pattern={bucket.pattern} size={14} gap={2} />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-mono text-[10px] text-text-tertiary">e.g.</span>
                  <span className={clsx('font-display font-bold text-sm uppercase', bucket.is_actual ? 'text-text-primary' : 'text-text-secondary')}>{repWord}</span>
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
/* Per-guess step                                                       */
/* ------------------------------------------------------------------ */

export default function GuessDetail({
  move,
  targetWord,
  gameId,
  aiCacheRef,
}: {
  move: MoveAnalysis;
  targetWord: string | null;
  gameId: string | null;
  aiCacheRef: { current: Map<number, string> };
}) {
  const n = move.move_number;
  // AI-written per-move commentary. Falls back to the rule-based commentary
  // (`buildCommentary`) if the LLM is unavailable or the request fails.
  // Cache lives on the page so flipping between steps doesn't re-hit the API.
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

  const isSolving = move.pattern === SOLVED_PATTERN;
  const optimalWord = move.optimal_word ?? move.bot_pick ?? '—';
  const skill = move.skill_score ?? 0;
  const remainBefore = move.remaining_before ?? move.remaining_words ?? 1;
  const picks: TopPick[] = move.top_picks?.length ? move.top_picks : move.candidates_top_n ?? [];
  const pDist: PatternBucket[] = move.pattern_distribution ?? [];

  const yourExpRem = move.expected_remaining ?? move.expected_solutions_after ?? null;
  const botExpRem = move.optimal_expected_remaining ?? null;
  const yourActual = move.actual_solutions_after ?? null;
  const yourExpSteps = move.expected_steps_until_solution ?? null;

  const yourSolChance = probWasSolution(move.guess_word, targetWord, remainBefore, move.remaining_words_list);
  const botSolChance = probWasSolution(optimalWord === '—' ? '' : optimalWord, targetWord, remainBefore, move.remaining_words_list);

  const botActualSolutionsAfter = move.optimal_actual_solutions_after ?? null;
  const botExpStepsUntilSolution = move.optimal_expected_steps_until_solution ?? null;

  const [expRemH, botExpRemH] = highlightPair(yourExpRem, botExpRem, 'lower');
  const [actualH, botActualH] = highlightPair(yourActual, botActualSolutionsAfter, 'lower');
  const yourSolNum = yourSolChance === '—' ? null : parseInt(yourSolChance.replace('%', ''));
  const botSolNum = botSolChance === '—' ? null : parseInt(botSolChance.replace('%', ''));
  const [solH, botSolH] = highlightPair(yourSolNum, botSolNum, 'higher');
  const [stepsH, botStepsH] = highlightPair(yourExpSteps, botExpStepsUntilSolution, 'lower');

  const numGroups = pDist.length;
  const largestGroup = pDist.length > 0 ? Math.max(...pDist.map((b) => b.count)) : null;
  const infoGained = move.info_gained ?? 0;
  const optimalInfo = move.optimal_info ?? 0;

  const botPDist: PatternBucket[] = move.optimal_pattern_distribution ?? [];
  const botNumGroups = move.optimal_num_groups ?? (botPDist.length || null);
  const botLargestGroup = move.optimal_largest_group ?? (botPDist.length > 0 ? Math.max(...botPDist.map((b) => b.count)) : null);

  const [groupsH, botGroupsH] = highlightPair(numGroups, botNumGroups, 'higher');
  const [largestH, botLargestH] = highlightPair(largestGroup, botLargestGroup, 'lower');
  const [bitsH, botBitsH] = highlightPair(infoGained, optimalInfo, 'higher');
  const classColor = move.classification ? classificationColor(move.classification) : 'var(--text-tertiary)';
  const statusIcon: React.ReactNode =
    move.classification === 'forced' ? (
      <Lock size={15} style={{ color: classColor, flexShrink: 0 }} aria-hidden="true" />
    ) : move.classification === 'brilliant' || move.classification === 'best' ? (
      <Check size={15} style={{ color: classColor, flexShrink: 0 }} aria-hidden="true" />
    ) : null;
  const guessTiles = patternToTiles(move.pattern).map((t) => (t === 'tbd' ? 'empty' : t));

  return (
    <section id={`guess-${n}`} data-guess={n} className="pt-2">
      <div className="rule-top pt-3 flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <Label className="block mb-1">guess {n}</Label>
          <h2 className="font-display text-display-md text-text-primary">Your {ordinal(n)} guess</h2>
        </div>
        <MiniTiles word={move.guess_word} states={guessTiles} size={26} />
      </div>

      {/* Comparison row */}
      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-6 mb-5">
        <div className="rule-hair pt-3 min-w-0">
          <Label className="block mb-2">
            <Hint term="skill">your guess · skill</Hint>
          </Label>
          <div className="flex items-center gap-2 flex-wrap">
            {statusIcon}
            <span className="font-display font-bold text-xl uppercase tracking-wide text-text-primary">{move.guess_word}</span>
            <span className="font-mono font-semibold text-lg tabular text-text-primary">{skill}</span>
            {move.classification && <MoveTag classification={move.classification} />}
          </div>
        </div>

        <div className="rule-hair pt-3 min-w-0">
          <Label className="block mb-2">best pick</Label>
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
        <p className="font-sans text-[15px] leading-relaxed mb-6 text-text-secondary">{aiCommentary || buildCommentary(move, optimalWord)}</p>
      )}

      {/* Solved variant — skip metrics/groups */}
      {isSolving ? (
        <div className="flex items-center gap-4 py-5 px-5 bg-wash-green flex-wrap">
          <MiniTiles word={move.guess_word} states={['correct', 'correct', 'correct', 'correct', 'correct']} size={26} />
          <span className="font-display text-display-sm text-text-primary">Solved in {n}.</span>
        </div>
      ) : (
        <>
          {/* Metrics matrix */}
          <div className="rule-top pt-4 mt-8">
            <Label className="block mb-4">your guess vs the engine&rsquo;s</Label>

            <div className="mb-3">
              <MetricMatrix
                rows={[
                  {
                    your: yourExpRem != null ? yourExpRem.toFixed(1) : '—',
                    bot: botExpRem != null ? botExpRem.toFixed(1) : '—',
                    label: 'Words left after the guess, on average',
                    yH: expRemH,
                    bH: botExpRemH,
                  },
                  {
                    your: yourActual != null ? String(yourActual) : '—',
                    bot: botActualSolutionsAfter != null ? String(botActualSolutionsAfter) : '—',
                    label: 'Words actually left after the guess',
                    yH: actualH,
                    bH: botActualH,
                  },
                  // "Chance the guess was the answer" is only meaningful when at
                  // least one side's word is in the answer pool. Both 0% adds nothing.
                  ...((yourSolChance === '0%' || yourSolChance === '—') && (botSolChance === '0%' || botSolChance === '—')
                    ? []
                    : [{ your: yourSolChance, bot: botSolChance, label: 'Chance the guess was the answer', yH: solH, bH: botSolH }]),
                  {
                    your: yourExpSteps != null ? yourExpSteps.toFixed(2) : '—',
                    bot: botExpStepsUntilSolution != null ? botExpStepsUntilSolution.toFixed(2) : '—',
                    label: 'Guesses still needed, on average',
                    yH: stepsH,
                    bH: botStepsH,
                  },
                ]}
              />
            </div>

            <p className="font-sans text-xs text-text-tertiary flex items-center gap-1.5 flex-wrap">
              The better number is <Chip value="highlighted" highlighted={true} />.
            </p>
          </div>

          {/* Pattern groups */}
          {pDist.length > 0 && (
            <div className="rule-top pt-4 mt-8">
              <p className="font-sans text-[15px] leading-relaxed mb-5 text-text-secondary">
                How each guess split the <strong className="text-text-primary font-semibold">{fmtInt(remainBefore)} words</strong> that were still possible
                before it. More and smaller groups mean faster solving.
              </p>

              <div className="mb-6">
                <MetricMatrix
                  rows={[
                    { your: String(numGroups), bot: botNumGroups != null ? String(botNumGroups) : '—', label: 'Number of groups', yH: groupsH, bH: botGroupsH },
                    {
                      your: largestGroup != null ? String(largestGroup) : '—',
                      bot: botLargestGroup != null ? String(botLargestGroup) : '—',
                      label: 'Largest group',
                      yH: largestH,
                      bH: botLargestH,
                    },
                    {
                      your: infoGained.toFixed(2),
                      bot: optimalInfo > 0 ? optimalInfo.toFixed(2) : '—',
                      label: (
                        <Hint term="information" side="bottom">
                          Narrowing (bits)
                        </Hint>
                      ),
                      yH: bitsH,
                      bH: botBitsH,
                    },
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-6">
                <PatternGroupPanel label={`Your groups, with ${move.guess_word}`} buckets={pDist} totalRemaining={remainBefore} />
                {botPDist.length > 0 ? (
                  <PatternGroupPanel label={`Engine's groups, with ${optimalWord}`} buckets={botPDist} totalRemaining={remainBefore} />
                ) : (
                  <div className="flex-1 min-w-0">
                    <Label className="block mb-3">{`Engine's groups, with ${optimalWord}`}</Label>
                    <p className="font-sans text-sm text-text-tertiary">Not available for this analysis.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
