'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import Keyboard from '@/components/Keyboard';
import TileSpinner from '@/components/TileSpinner';
import { analysisApi, errorMessage, OpenerReport } from '@/lib/api';
import { springs } from '@/lib/animations';
import clsx from 'clsx';
import WordInputRow from './WordInputRow';
import { useWordInput } from './useWordInput';
import {
  AnswerDot,
  Bar,
  Chip,
  ErrorLine,
  LabCard,
  MicroLabel,
  MiniPattern,
  MiniWord,
  StatTile,
  formatInt,
} from './LabPrimitives';

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
    <div className="flex flex-col gap-6">
      {/* ── Input: board row + quick picks + keyboard ───────────────────── */}
      <div className="flex flex-col items-center gap-4">
        <WordInputRow word={input.word} shaking={input.shaking} busy={loading} label="Opener to analyse" />
        <div className="h-5 flex items-center" aria-live="polite">
          {input.notice ? (
            <span className="font-sans text-sm font-semibold text-text-primary">{input.notice}</span>
          ) : (
            <span className="font-sans text-xs text-text-ghost">Type a word and press Enter</span>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2" aria-label="Quick picks">
          {QUICK_PICKS.map((w) => (
            <Chip key={w} tone={report?.word === w ? 'green' : 'neutral'} active={report?.word === w} onClick={() => quickPick(w)}>
              <span className="font-mono tracking-wider">{w}</span>
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
          <span className="font-sans text-xs text-text-secondary">Splitting 2,309 answers into feedback buckets…</span>
        </div>
      )}

      {!loading && !report && !error && (
        <div className="rounded-card-lg border border-dashed border-border-default px-6 py-10 text-center">
          <p className="font-sans text-sm text-text-secondary">
            Any legal five-letter word works — your favourite opener, a word you&apos;re curious about, or a guess
            that went badly.
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

  return (
    <motion.div
      key={report.word}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }}
      transition={springs.slide}
      className="flex flex-col gap-5"
    >
      {/* Verdict header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <MiniWord word={report.word} state={verdict.state} size={34} />
          <div className="flex flex-col">
            <span className="font-display font-black tracking-tight text-xl text-text-primary leading-tight">{verdict.label}</span>
            <span className="font-sans text-xs text-text-secondary">
              #{formatInt(report.rank)} of {formatInt(report.total_guesses)} legal guesses
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Chip tone={report.facts.is_possible_answer ? 'green' : 'neutral'}>
            {report.facts.is_possible_answer ? 'Possible answer' : 'Not an answer word'}
          </Chip>
          <Chip tone="neutral">{report.facts.unique_letters} unique letters</Chip>
          <Chip tone="neutral">
            {report.facts.vowels} vowel{report.facts.vowels === 1 ? '' : 's'}
          </Chip>
          {report.facts.repeated_letters > 0 && <Chip tone="yellow">{report.facts.repeated_letters} repeated</Chip>}
          <Chip tone="neutral">Difficulty {formatInt(report.facts.difficulty_elo)}</Chip>
        </div>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile
          label="Information"
          value={report.entropy.toFixed(2)}
          unit="bits"
          sub={`best ${report.best_entropy.toFixed(2)} · ${Math.round(report.efficiency * 100)}% of max`}
          accent={verdict.state === 'absent' ? undefined : `var(--tile-${verdict.state})`}
          delay={0}
        />
        <StatTile label="Rank" value={`#${formatInt(report.rank)}`} sub={`of ${formatInt(report.total_guesses)} guesses`} delay={0.04} />
        <StatTile label="Percentile" value={`top ${topShare.toFixed(1)}%`} sub={`${report.percentile.toFixed(1)}th percentile`} delay={0.08} />
        <StatTile
          label="Expected left"
          value={report.expected_remaining.toFixed(1)}
          sub={`answers after this guess, of ${formatInt(report.answers_total)}`}
          delay={0.12}
        />
        <StatTile
          label="Worst case"
          value={formatInt(report.worst_case_remaining)}
          sub="answers in the largest bucket"
          delay={0.16}
        />
      </div>

      {/* Efficiency bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <MicroLabel>Efficiency vs best opener</MicroLabel>
          <span className="font-mono text-[11px] tabular-nums text-text-secondary">
            {report.entropy.toFixed(2)} / {report.best_entropy.toFixed(2)} bits
            {best && best.word !== report.word && (
              <>
                {' '}
                · best is <span className="text-text-primary font-semibold">{best.word}</span>
              </>
            )}
          </span>
        </div>
        <Bar fraction={report.efficiency} />
      </div>

      {/* Pattern spread */}
      <LabCard
        title="Pattern spread"
        aside={`${formatInt(report.distinct_patterns)} distinct patterns · top ${report.pattern_buckets.length} shown`}
        padded={false}
      >
        <div className="divide-y divide-border-subtle">
          {report.pattern_buckets.map((b, i) => (
            <motion.div
              key={b.pattern}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <MiniPattern pattern={b.pattern} size={14} />
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Bar fraction={b.probability / maxBucket} height={6} />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-text-secondary w-12 text-right shrink-0">
                    {(b.probability * 100).toFixed(1)}%
                  </span>
                </div>
                <span className="font-mono text-[11px] text-text-tertiary truncate lowercase">
                  {b.examples.slice(0, 3).join(' · ')}
                  {b.count > 3 && <span className="text-text-ghost"> · +{formatInt(b.count - 3)}</span>}
                </span>
              </div>
              <span className="font-mono text-sm font-semibold tabular-nums text-text-primary w-12 text-right shrink-0">
                {formatInt(b.count)}
              </span>
            </motion.div>
          ))}
        </div>
        <div className="px-4 py-2.5 border-t border-border-subtle">
          <span className="font-sans text-[11px] text-text-ghost">
            Each row is one feedback colouring and the answers that would produce it. Flatter spread = more bits.
          </span>
        </div>
      </LabCard>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Best openers */}
        <LabCard title="Best openers" aside="by information gained" padded={false} className="lg:col-span-3">
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle">
            <MicroLabel className="w-7 text-right shrink-0">#</MicroLabel>
            <MicroLabel className="flex-1">Word</MicroLabel>
            <MicroLabel className="w-14 text-right shrink-0">Bits</MicroLabel>
            <MicroLabel className="w-14 text-right shrink-0">Exp.</MicroLabel>
            <span className="w-2 shrink-0" />
          </div>
          <div className="divide-y divide-border-subtle">
            {report.best_openers.map((p) => {
              const isCurrent = p.word === report.word;
              return (
                <button
                  key={p.word}
                  type="button"
                  onClick={() => onPick(p.word)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2',
                    isCurrent ? 'bg-bg-elevated border-l-4 border-l-tile-correct' : 'hover:bg-bg-elevated/50'
                  )}
                  style={{ outlineColor: 'var(--tile-correct)' }}
                  aria-label={`Analyse ${p.word}`}
                >
                  <span className="font-display font-bold text-sm tabular-nums w-7 text-right shrink-0 text-text-ghost">{p.rank}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <MiniWord word={p.word} state={isCurrent ? 'correct' : 'absent'} size={18} />
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-text-primary w-14 text-right shrink-0">
                    {p.entropy.toFixed(2)}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-text-secondary w-14 text-right shrink-0">
                    {p.expected_remaining.toFixed(1)}
                  </span>
                  <AnswerDot on={p.is_possible_answer} />
                </button>
              );
            })}
          </div>
          <div className="px-4 py-2.5 border-t border-border-subtle flex items-center gap-2">
            <AnswerDot on />
            <span className="font-sans text-[11px] text-text-ghost">= also a possible answer. Tap a row to analyse it.</span>
          </div>
        </LabCard>

        {/* Neighbours + facts */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <LabCard title="Ranked nearby" aside="2 above · 2 below">
            <div className="flex flex-col gap-1.5">
              {report.neighbours.map((n) => {
                const isCurrent = n.word === report.word;
                return (
                  <button
                    key={n.word}
                    type="button"
                    onClick={() => !isCurrent && onPick(n.word)}
                    className={clsx(
                      'flex items-center gap-3 px-3 py-2 rounded-card border transition-colors text-left focus-visible:outline-none focus-visible:ring-2',
                      isCurrent
                        ? 'border-tile-correct bg-bg-elevated cursor-default'
                        : 'border-border-subtle hover:border-border-strong'
                    )}
                    style={{ outlineColor: 'var(--tile-correct)' }}
                    aria-current={isCurrent ? 'true' : undefined}
                  >
                    <span className="font-display font-bold text-xs tabular-nums w-14 shrink-0 text-text-ghost">
                      #{formatInt(n.rank)}
                    </span>
                    <span
                      className={clsx(
                        'font-mono text-sm font-semibold tracking-wider flex-1',
                        isCurrent ? 'text-tile-correct' : 'text-text-primary'
                      )}
                    >
                      {n.word}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-text-secondary">{n.entropy.toFixed(3)}</span>
                  </button>
                );
              })}
            </div>
          </LabCard>

          <LabCard title="How to read this">
            <ul className="flex flex-col gap-2 font-sans text-xs text-text-secondary leading-relaxed">
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
