'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import { RotateCcw, Undo2 } from 'lucide-react';
import Keyboard from '@/components/Keyboard';
import Tile from '@/components/Tile';
import TileSpinner from '@/components/TileSpinner';
import { analysisApi, errorMessage, PositionReport } from '@/lib/api';
import { patternToTiles, TileState } from '@/lib/types';
import { springs } from '@/lib/animations';
import { Button, Label, MiniTiles } from '@/components/ui';
import clsx from 'clsx';
import WordInputRow from './WordInputRow';
import { useWordInput } from './useWordInput';
import { AnswerDot, Chip, ErrorLine, LabCard, MiniPattern, StatTile, formatInt } from './LabPrimitives';

const MAX_GUESSES = 6;
const ANSWERS_TOTAL = 2309;
const WORD_RE = /^[A-Z]{5}$/;
const CYCLE: Record<number, number> = { 0: 1, 1: 2, 2: 0 };

/** val at position (0 = leftmost) of a ternary-encoded pattern. */
function valueAt(pattern: number, pos: number): number {
  return Math.floor(pattern / 3 ** pos) % 3;
}
function withValue(pattern: number, pos: number, val: number): number {
  return pattern + (val - valueAt(pattern, pos)) * 3 ** pos;
}
function stateFor(val: number): TileState {
  return val === 2 ? 'correct' : val === 1 ? 'present' : 'absent';
}

export default function PositionExplorer() {
  const input = useWordInput();
  const { setWord, clear, shake } = input;
  const [guesses, setGuesses] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<number[]>([]);
  const [report, setReport] = useState<PositionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealRow, setRevealRow] = useState(-1);
  const reqId = useRef(0);
  const lastFetchedKey = useRef<string | null>(null);

  const key = `${guesses.join(',')}|${patterns.join(',')}`;
  const solved = !!report?.solved && lastFetchedKey.current === key;
  const canType = guesses.length < MAX_GUESSES && !solved;

  // Re-evaluate the position whenever the painted board changes (debounced
  // slightly so cycling a tile through its three colours is one request).
  useEffect(() => {
    if (lastFetchedKey.current === key) return;
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(
      () => {
        analysisApi
          .labPosition(guesses, patterns)
          .then((res) => {
            if (id !== reqId.current) return;
            lastFetchedKey.current = key;
            setReport(res.data);
            setError(null);
          })
          .catch((err) => {
            if (id !== reqId.current) return;
            setError(errorMessage(err, 'The lab could not evaluate this position.'));
          })
          .finally(() => {
            if (id === reqId.current) setLoading(false);
          });
      },
      guesses.length ? 220 : 0
    );
    return () => clearTimeout(t);
  }, [key, guesses, patterns]);

  // Clear the flip-reveal flag after the animation has played.
  useEffect(() => {
    if (revealRow < 0) return;
    const t = setTimeout(() => setRevealRow(-1), 5 * 150 + 600);
    return () => clearTimeout(t);
  }, [revealRow]);

  const submitGuess = useCallback(async () => {
    if (!canType || loading) return;
    const w = input.word.toUpperCase();
    if (w.length < 5) {
      shake('Not enough letters');
      return;
    }
    if (!WORD_RE.test(w)) {
      shake('Letters only');
      return;
    }
    const nextGuesses = [...guesses, w];
    const nextPatterns = [...patterns, 0];
    const nextKey = `${nextGuesses.join(',')}|${nextPatterns.join(',')}`;
    const id = ++reqId.current;
    setLoading(true);
    setSubmitting(true);
    try {
      const res = await analysisApi.labPosition(nextGuesses, nextPatterns);
      if (id !== reqId.current) return;
      lastFetchedKey.current = nextKey;
      setReport(res.data);
      setError(null);
      setGuesses(nextGuesses);
      setPatterns(nextPatterns);
      setRevealRow(nextGuesses.length - 1);
      clear();
    } catch (err) {
      if (id !== reqId.current) return;
      const status = (err as AxiosError)?.response?.status;
      if (status === 422) shake(errorMessage(err, 'Not in word list'));
      else setError(errorMessage(err, 'The lab could not evaluate this position.'));
    } finally {
      setSubmitting(false);
      if (id === reqId.current) setLoading(false);
    }
  }, [canType, loading, input.word, guesses, patterns, shake, clear]);

  const paint = (row: number, pos: number) => {
    setPatterns((prev) => {
      const next = [...prev];
      const cur = valueAt(next[row], pos);
      next[row] = withValue(next[row], pos, CYCLE[cur]);
      return next;
    });
  };

  const undo = () => {
    if (!guesses.length) return;
    setGuesses((g) => g.slice(0, -1));
    setPatterns((p) => p.slice(0, -1));
  };

  const reset = () => {
    setGuesses([]);
    setPatterns([]);
    clear();
  };

  // Keyboard colours follow the painted feedback (correct > present > absent).
  const letterStates = useMemo(() => {
    const rank: Record<string, number> = { absent: 0, present: 1, correct: 2 };
    const out: Record<string, TileState> = {};
    guesses.forEach((g, r) => {
      const tiles = patternToTiles(patterns[r]);
      g.split('').forEach((ch, i) => {
        const s = tiles[i];
        if (!out[ch] || rank[s] > rank[out[ch]]) out[ch] = s;
      });
    });
    return out;
  }, [guesses, patterns]);

  const isWinRow = (r: number) => patterns[r] === 242;

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      {/* ── Board ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-4">
        <div role="grid" aria-label="Painted Wordle board" className="flex flex-col items-center" style={{ gap: 'var(--tile-gap)' }}>
          {guesses.map((g, r) => (
            <div key={`${r}-${g}`} role="row" className="flex" style={{ gap: 'var(--tile-gap)' }}>
              {g.split('').map((ch, i) => {
                const val = valueAt(patterns[r], i);
                const state = stateFor(val);
                const winReady = isWinRow(r) && revealRow !== r && solved && r === guesses.length - 1;
                return (
                  <motion.button
                    key={i}
                    type="button"
                    role="gridcell"
                    whileTap={{ scale: 0.94 }}
                    onClick={() => paint(r, i)}
                    className="block p-0 border-0 bg-transparent cursor-pointer"
                    style={{
                      ...(winReady
                        ? { animation: 'win-bounce 600ms ease', animationDelay: `${i * 100}ms`, animationFillMode: 'both' }
                        : {}),
                    }}
                    aria-label={`${ch}, ${state}, position ${i + 1}. Tap to cycle colour.`}
                  >
                    <Tile letter={ch} state={state} position={i} isFlipping={revealRow === r} flipDelay={revealRow === r ? i * 0.15 : 0} />
                  </motion.button>
                );
              })}
            </div>
          ))}
          {canType && <WordInputRow word={input.word} shaking={input.shaking} busy={submitting} label="Next guess" />}
        </div>

        <div className="h-5 flex items-center text-center" aria-live="polite">
          {input.notice ? (
            <span className="font-mono text-xs text-text-primary">{input.notice}</span>
          ) : solved ? (
            <span className="font-mono text-xs text-text-primary">Solved in {guesses.length} — nothing left to learn.</span>
          ) : guesses.length === 0 ? (
            <span className="font-mono text-label uppercase text-text-tertiary">enter the guess you played · tap tiles to paint the colours</span>
          ) : canType ? (
            <span className="font-mono text-label uppercase text-text-tertiary">tap tiles to paint · gray → yellow → green</span>
          ) : (
            <span className="font-mono text-label uppercase text-text-tertiary">six guesses used — undo one to keep exploring</span>
          )}
        </div>

        {guesses.length > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={undo}>
              <Undo2 size={13} aria-hidden="true" />
              Undo guess
            </Button>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw size={13} aria-hidden="true" />
              Reset
            </Button>
          </div>
        )}

        {canType && <Keyboard onKey={input.onKey} onEnter={submitGuess} onBackspace={input.onBackspace} letterStates={letterStates} />}
        <ErrorLine message={error} />
      </div>

      {/* ── Evaluation ────────────────────────────────────────────────────── */}
      {!report && loading && (
        <div className="flex flex-col items-center gap-3 py-10">
          <TileSpinner size="md" label="Evaluating position" />
          <span className="font-mono text-xs text-text-secondary">asking the engine…</span>
        </div>
      )}

      {report && <PositionResults report={report} guesses={guesses} solved={solved} dimmed={loading} onUse={canType ? setWord : undefined} />}
    </div>
  );
}

// ─── Results ──────────────────────────────────────────────────────────────────
function PositionResults({
  report,
  guesses,
  solved,
  dimmed,
  onUse,
}: {
  report: PositionReport;
  guesses: string[];
  solved: boolean;
  dimmed: boolean;
  onUse?: (word: string) => void;
}) {
  const impossible = report.remaining === 0;
  const remainingAccent = impossible ? 'var(--red)' : report.remaining === 1 ? 'var(--tile-correct)' : undefined;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }} transition={springs.slide} className="flex flex-col gap-12 md:gap-16">
      {solved && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.snappy}
          className="bg-wash-green px-5 md:px-8 py-5 flex items-center gap-4 flex-wrap"
        >
          <MiniTiles word={guesses[guesses.length - 1] ?? ''} states={['correct', 'correct', 'correct', 'correct', 'correct']} size={26} />
          <span className="font-display text-display-sm text-text-primary">
            Solved in {guesses.length}/{MAX_GUESSES}.
          </span>
          <span className="font-sans text-xs text-text-secondary">Undo a guess to see what else would have worked.</span>
        </motion.div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-8">
        <StatTile
          label="answers left"
          value={report.remaining}
          decimals={0}
          sub={impossible ? 'no answer fits — check your colours' : `of ${formatInt(ANSWERS_TOTAL)} possible answers`}
          accent={remainingAccent}
        />
        <StatTile label="uncertainty" value={report.entropy_left} decimals={2} unit="bits" sub="log₂ of answers left" delay={0.04} />
        <StatTile label="guesses" value={`${guesses.length}/${MAX_GUESSES}`} sub={guesses.length ? 'painted so far' : 'opening position'} delay={0.08} />
      </div>

      {/* Path */}
      {report.history.length > 0 && (
        <LabCard title="Your path" eyebrow="history" aside="answers before → after" padded={false}>
          <div>
            {report.history.map((h, i) => {
              const bits = h.remaining_after > 0 ? Math.log2(h.remaining_before / h.remaining_after) : null;
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast">
                  <span className="font-mono text-xs tabular w-5 text-right shrink-0 text-text-tertiary">{i + 1}</span>
                  <MiniPattern pattern={h.pattern} letters={h.guess} size={18} />
                  <span className="flex-1 font-mono text-xs tabular text-text-secondary text-right">
                    {formatInt(h.remaining_before)} → <span className="text-text-primary font-semibold">{formatInt(h.remaining_after)}</span>
                  </span>
                  <span className="font-mono text-xs tabular w-20 text-right shrink-0" style={{ color: bits == null ? 'var(--red)' : undefined }}>
                    {bits == null ? 'impossible' : `+${bits.toFixed(2)} bits`}
                  </span>
                </div>
              );
            })}
          </div>
        </LabCard>
      )}

      {impossible ? (
        <div className="bg-wash-accent px-5 md:px-8 py-6">
          <p className="font-display text-display-sm text-text-primary max-w-xl">
            No answer in the list produces that feedback. Tap the tiles to fix a colour, or undo the last guess.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 md:gap-8">
          {/* Top picks */}
          <LabCard
            title={solved ? 'Best next guess (if it weren’t over)' : 'What should I guess next?'}
            eyebrow="engine"
            aside="top picks"
            padded={false}
            className="md:col-span-7"
          >
            {report.top_picks.length === 0 ? (
              <div className="py-8 font-sans text-sm text-text-secondary">Nothing to suggest.</div>
            ) : (
              <>
                <div className="flex items-center gap-3 py-2 border-b border-border-subtle">
                  <Label className="w-5 text-right shrink-0">#</Label>
                  <Label className="flex-1">word</Label>
                  <Label className="w-12 text-right shrink-0">bits</Label>
                  <Label className="w-12 text-right shrink-0">exp.</Label>
                  <Label className="w-12 text-right shrink-0 hidden sm:block">worst</Label>
                  <span className="w-2 shrink-0" />
                </div>
                <div>
                  {report.top_picks.map((p, i) => {
                    const row = (
                      <>
                        <span className={clsx('font-mono text-xs tabular w-5 text-right shrink-0', i === 0 ? 'text-accent' : 'text-text-tertiary')}>{i + 1}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <MiniTiles word={p.word} states={Array.from({ length: 5 }, () => (i === 0 ? 'correct' : 'absent'))} size={18} gap={2} />
                        </div>
                        <span className="font-mono text-sm font-semibold tabular text-text-primary w-12 text-right shrink-0">{p.entropy.toFixed(2)}</span>
                        <span className="font-mono text-xs tabular text-text-secondary w-12 text-right shrink-0">{p.expected_remaining.toFixed(1)}</span>
                        <span className="font-mono text-xs tabular text-text-secondary w-12 text-right shrink-0 hidden sm:block">
                          {formatInt(p.worst_case_remaining)}
                        </span>
                        <AnswerDot on={p.is_possible_answer} />
                      </>
                    );
                    return onUse ? (
                      <button
                        key={p.word}
                        type="button"
                        onClick={() => onUse(p.word)}
                        className="w-full flex items-center gap-3 py-2.5 text-left border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast"
                        aria-label={`Type ${p.word} as the next guess`}
                      >
                        {row}
                      </button>
                    ) : (
                      <div key={p.word} className="flex items-center gap-3 py-2.5 border-b border-border-subtle">
                        {row}
                      </div>
                    );
                  })}
                </div>
                <div className="pt-3 flex items-center gap-2">
                  <AnswerDot on />
                  <span className="font-sans text-xs text-text-tertiary">
                    = could be the answer.{onUse ? ' Tap a row to type it in.' : ''}
                  </span>
                </div>
              </>
            )}
          </LabCard>

          {/* Remaining words */}
          <LabCard
            title="Still possible"
            eyebrow="answer pool"
            aside={report.remaining_truncated ? `showing ${report.remaining_words.length} of ${formatInt(report.remaining)}` : `${formatInt(report.remaining)} word${report.remaining === 1 ? '' : 's'}`}
            className="md:col-span-5"
          >
            <div className="flex flex-wrap gap-1.5">
              {report.remaining_words.map((w) => (
                <Chip key={w} tone={report.remaining === 1 ? 'green' : 'neutral'} onClick={onUse ? () => onUse(w) : undefined} className={clsx(!onUse && 'cursor-default')}>
                  {w}
                </Chip>
              ))}
            </div>
            {report.remaining_truncated && (
              <p className="font-sans text-xs text-text-tertiary mt-3">
                Too many to list — paint another guess to narrow it down.
              </p>
            )}
          </LabCard>
        </div>
      )}
    </motion.div>
  );
}
