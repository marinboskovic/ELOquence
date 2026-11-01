'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import Keyboard from '@/components/Keyboard';
import TileSpinner from '@/components/TileSpinner';
import { analysisApi, errorMessage, OpenerReport } from '@/lib/api';
import { springs } from '@/lib/animations';
import { Label, MiniTiles, Tag } from '@/components/ui';
import clsx from 'clsx';
import WordInputRow from './WordInputRow';
import { useWordInput } from './useWordInput';
import { AnswerDot, Bar, Chip, ErrorLine, LabCard, MiniPattern, MiniWord, StatTile, formatInt } from './LabPrimitives';

const QUICK_PICKS = ['SLATE', 'CRANE', 'TRACE', 'ADIEU', 'AUDIO'];
const WORD_RE = /^[A-Z]{5}$/;

interface OpenerAnalyserProps {
  /** Word from `?word=` — analysed once on mount. */
  initialWord?: string | null;
}

function verdictFor(report: OpenerReport): { label: string; state: 'correct' | 'present' | 'absent' } {
  if (report.rank <= 25) return { label: 'Elite opener', state: 'correct' };
  if (report.percentile >= 75) return { label: 'Solid opener', state: 'present' };
  return { label: 'Weak opener', state: 'absent' };
}

export default function OpenerAnalyser({ initialWord }: OpenerAnalyserProps) {
  const input = useWordInput();
  const { setWord, shake } = input;
  const [report, setReport] = useState<OpenerReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const analyse = useCallback(
    async (raw: string) => {
      const w = raw.toUpperCase();
      if (w.length < 5) {
        shake('Not enough letters');
        return;
      }
      if (!WORD_RE.test(w)) {
        shake('Letters only');
        return;
      }
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await analysisApi.labOpener(w);
        if (id !== reqId.current) return;
        setReport(res.data);
        setWord(w);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('word', w);
          url.searchParams.delete('tab');
          window.history.replaceState(window.history.state, '', url.toString());
        }
      } catch (err) {
        if (id !== reqId.current) return;
        const status = (err as AxiosError)?.response?.status;
        if (status === 422) {
          shake(errorMessage(err, 'Not in word list'));
        } else {
          setError(errorMessage(err, 'The lab could not analyse that word. Try again.'));
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [setWord, shake]
  );

  // `?word=` deep link — once.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    const w = (initialWord ?? '').toUpperCase();
    if (WORD_RE.test(w)) {
      setWord(w);
      void analyse(w);
    }
  }, [initialWord, analyse, setWord]);

  const onEnter = useCallback(() => {
    if (loading) return;
    void analyse(input.word);
  }, [analyse, input.word, loading]);

  const quickPick = (w: string) => {
    setWord(w);
    void analyse(w);
  };

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      {/* ── Input: board row + quick picks + keyboard ───────────────────── */}
      <div className="flex flex-col items-center gap-5">
        <WordInputRow word={input.word} shaking={input.shaking} busy={loading} label="Opener to analyse" />
        <div className="h-5 flex items-center" aria-live="polite">
          {input.notice ? (
            <span className="font-mono text-xs text-text-primary">{input.notice}</span>
          ) : (
            <span className="font-mono text-label uppercase text-text-tertiary">type a word · enter</span>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2" aria-label="Quick picks">
          {QUICK_PICKS.map((w) => (
            <Chip key={w} tone="neutral" active={report?.word === w} onClick={() => quickPick(w)}>
              {w}
            </Chip>
          ))}
        </div>

        <Keyboard onKey={input.onKey} onEnter={onEnter} onBackspace={input.onBackspace} letterStates={{}} />
        <ErrorLine message={error} />
      </div>

      {/* ── Results ───────────────────────────────────────────────────────── */}
      {loading && !report && (
        <div className="flex flex-col items-center gap-3 py-10">
          <TileSpinner size="md" label="Analysing opener" />
          <span className="font-mono text-xs text-text-secondary">splitting 2,309 answers into feedback buckets…</span>
        </div>
      )}

      {!loading && !report && !error && (
        <div className="rule-top pt-6 grid md:grid-cols-12 gap-4">
          <p className="md:col-span-7 font-display text-display-sm text-text-primary">
            Any legal five-letter word works — your favourite opener, a word you&apos;re curious about, or a guess that
            went badly.
          </p>
        </div>
      )}

      {report && <OpenerResults report={report} onPick={quickPick} dimmed={loading} />}
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────
function OpenerResults({
  report,
  onPick,
  dimmed,
}: {
  report: OpenerReport;
  onPick: (word: string) => void;
  dimmed: boolean;
}) {
  const verdict = verdictFor(report);
  const topShare = report.percentile >= 100 ? 0.1 : Math.max(0.1, 100 - report.percentile);
  const maxBucket = Math.max(...report.pattern_buckets.map((b) => b.probability), 0.0001);
  const best = report.best_openers[0];
  const states = Array.from({ length: 5 }, () => verdict.state);

  return (
    <motion.div
      key={report.word}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }}
      transition={springs.slide}
      className="flex flex-col gap-12 md:gap-16"
    >
      {/* Verdict: the page's one ink block */}
      <div className="bg-bg-ink text-text-on-ink px-5 md:px-8 py-6 md:py-8 grid md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7 flex flex-col gap-4">
          <MiniTiles word={report.word} states={states} size={40} gap={4} />
          <div>
            <h2 className="font-display text-display-md text-text-on-ink">{verdict.label}</h2>
            <span className="font-mono text-xs text-text-on-ink opacity-70 tabular">
              #{formatInt(report.rank)} of {formatInt(report.total_guesses)} legal guesses
            </span>
          </div>
        </div>
        <div className="md:col-span-5 flex md:justify-end items-center gap-2 flex-wrap">
          <Tag tone={report.facts.is_possible_answer ? 'green' : 'on-ink'}>
            {report.facts.is_possible_answer ? 'possible answer' : 'not an answer word'}
          </Tag>
          <Tag tone="on-ink">{report.facts.unique_letters} unique</Tag>
          <Tag tone="on-ink">
            {report.facts.vowels} vowel{report.facts.vowels === 1 ? '' : 's'}
          </Tag>
          {report.facts.repeated_letters > 0 && <Tag tone="ochre">{report.facts.repeated_letters} repeated</Tag>}
          <Tag tone="on-ink">difficulty {formatInt(report.facts.difficulty_elo)}</Tag>
        </div>
      </div>

      {/* Headline numbers — count up on load */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8">
        <StatTile
          label="information"
          value={report.entropy}
          decimals={2}
          unit="bits"
          sub={`best ${report.best_entropy.toFixed(2)} · ${Math.round(report.efficiency * 100)}% of max`}
          accent={verdict.state === 'absent' ? undefined : `var(--text-${verdict.state})`}
          delay={0}
        />
        <StatTile label="rank" prefix="#" value={report.rank} decimals={0} sub={`of ${formatInt(report.total_guesses)} guesses`} delay={0.04} />
        <StatTile label="percentile" prefix="top " value={topShare} decimals={1} unit="%" sub={`${report.percentile.toFixed(1)}th percentile`} delay={0.08} />
        <StatTile
          label="expected left"
          value={report.expected_remaining}
          decimals={1}
          sub={`answers after this guess, of ${formatInt(report.answers_total)}`}
          delay={0.12}
        />
        <StatTile label="worst case" value={report.worst_case_remaining} decimals={0} sub="answers in the largest bucket" delay={0.16} />
      </div>

      {/* Efficiency bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <Label>efficiency vs best opener</Label>
          <span className="font-mono text-[11px] tabular text-text-secondary">
            {report.entropy.toFixed(2)} / {report.best_entropy.toFixed(2)} bits
            {best && best.word !== report.word && (
              <>
                {' '}
                · best is <span className="text-text-primary font-semibold">{best.word}</span>
              </>
            )}
          </span>
        </div>
        <Bar fraction={report.efficiency} height={4} delay={0.2} />
      </div>

      {/* Pattern spread */}
      <LabCard
        title="Pattern spread"
        eyebrow="feedback buckets"
        aside={`${formatInt(report.distinct_patterns)} distinct patterns · top ${report.pattern_buckets.length} shown`}
        padded={false}
      >
        <div>
          {report.pattern_buckets.map((b, i) => (
            <motion.div
              key={b.pattern}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
              className="flex items-center gap-4 py-2.5 border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast"
            >
              <MiniPattern pattern={b.pattern} size={14} />
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Bar fraction={b.probability / maxBucket} delay={0.25 + Math.min(i * 0.04, 0.5)} />
                  </div>
                  <span className="font-mono text-[11px] tabular text-text-secondary w-12 text-right shrink-0">
                    {(b.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <span className="font-mono text-[11px] text-text-tertiary truncate lowercase">
                  {b.examples.slice(0, 3).join(' · ')}
                  {b.count > 3 && <span className="text-text-tertiary"> · +{formatInt(b.count - 3)}</span>}
                </span>
              </div>
              <span className="font-mono text-sm font-semibold tabular text-text-primary w-12 text-right shrink-0">
                {formatInt(b.count)}
              </span>
            </motion.div>
          ))}
        </div>
        <p className="pt-3 font-sans text-xs text-text-tertiary">
          Each row is one feedback colouring and the answers that would produce it. Flatter spread = more bits.
        </p>
      </LabCard>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
        {/* Best openers */}
        <LabCard title="Best openers" eyebrow="ranked" aside="by information gained" padded={false} className="md:col-span-7">
          <div className="flex items-center gap-3 py-2 border-b border-border-subtle">
            <Label className="w-7 text-right shrink-0">#</Label>
            <Label className="flex-1">word</Label>
            <Label className="w-14 text-right shrink-0">bits</Label>
            <Label className="w-14 text-right shrink-0">exp.</Label>
            <span className="w-2 shrink-0" />
          </div>
          <div>
            {report.best_openers.map((p) => {
              const isCurrent = p.word === report.word;
              return (
                <button
                  key={p.word}
                  type="button"
                  onClick={() => onPick(p.word)}
                  className={clsx(
                    'w-full flex items-center gap-3 py-2.5 text-left border-b border-border-subtle transition-colors duration-fast',
                    isCurrent ? 'bg-bg-elevated' : 'hover:bg-bg-elevated'
                  )}
                  aria-label={`Analyse ${p.word}`}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className={clsx('font-mono text-xs tabular w-7 text-right shrink-0', isCurrent ? 'text-accent' : 'text-text-tertiary')}>{p.rank}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <MiniWord word={p.word} state={isCurrent ? 'correct' : 'absent'} size={18} />
                  </div>
                  <span className="font-mono text-sm font-semibold tabular text-text-primary w-14 text-right shrink-0">
                    {p.entropy.toFixed(2)}
                  </span>
                  <span className="font-mono text-xs tabular text-text-secondary w-14 text-right shrink-0">
                    {p.expected_remaining.toFixed(1)}
                  </span>
                  <AnswerDot on={p.is_possible_answer} />
                </button>
              );
            })}
          </div>
          <div className="pt-3 flex items-center gap-2">
            <AnswerDot on />
            <span className="font-sans text-xs text-text-tertiary">= also a possible answer. Tap a row to analyse it.</span>
          </div>
        </LabCard>

        {/* Neighbours + facts */}
        <div className="md:col-span-5 flex flex-col gap-12">
          <LabCard title="Ranked nearby" eyebrow="context" aside="2 above · 2 below" padded={false}>
            <div>
              {report.neighbours.map((n) => {
                const isCurrent = n.word === report.word;
                return (
                  <button
                    key={n.word}
                    type="button"
                    onClick={() => !isCurrent && onPick(n.word)}
                    className={clsx(
                      'w-full flex items-center gap-3 py-2.5 border-b border-border-subtle text-left transition-colors duration-fast',
                      isCurrent ? 'bg-bg-elevated cursor-default' : 'hover:bg-bg-elevated'
                    )}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <span className={clsx('font-mono text-xs tabular w-14 shrink-0', isCurrent ? 'text-accent' : 'text-text-tertiary')}>
                      #{formatInt(n.rank)}
                    </span>
                    <span className="font-display font-bold text-sm tracking-wide flex-1 text-text-primary">{n.word}</span>
                    <span className="font-mono text-xs tabular text-text-secondary">{n.entropy.toFixed(3)}</span>
                  </button>
                );
              })}
            </div>
          </LabCard>

          <LabCard title="How to read this" eyebrow="glossary">
            <ul className="flex flex-col gap-3 font-sans text-sm text-text-secondary leading-relaxed">
              <li>
                <span className="font-semibold text-text-primary">Bits</span> — information gained on average. One bit halves
                the answer pool; {report.entropy.toFixed(1)} bits cuts {formatInt(report.answers_total)} down to about{' '}
                {report.expected_remaining.toFixed(0)}.
              </li>
              <li>
                <span className="font-semibold text-text-primary">Expected left</span> — the average number of answers still
                possible after this guess, weighted by how likely each pattern is.
              </li>
              <li>
                <span className="font-semibold text-text-primary">Worst case</span> — the biggest single bucket, usually
                all-gray. That is how bad an unlucky first guess can get.
              </li>
            </ul>
          </LabCard>
        </div>
      </div>
    </motion.div>
  );
}
