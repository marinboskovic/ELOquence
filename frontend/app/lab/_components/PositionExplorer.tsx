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
import clsx from 'clsx';
import WordInputRow from './WordInputRow';
import { useWordInput } from './useWordInput';
import { AnswerDot, Chip, ErrorLine, LabCard, MicroLabel, MiniPattern, MiniWord, StatTile, formatInt } from './LabPrimitives';

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
    <div className="flex flex-col gap-6">
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
                    className="block p-0 border-0 bg-transparent rounded-tile focus-visible:outline-none focus-visible:ring-2 cursor-pointer"
                    style={{
                      outlineColor: 'var(--tile-correct)',
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
            <span className="font-sans text-sm font-semibold text-text-primary">{input.notice}</span>
          ) : solved ? (
            <span className="font-sans text-sm font-semibold" style={{ color: 'var(--tile-correct)' }}>
              Solved in {guesses.length} — nothing left to learn.
            </span>
          ) : guesses.length === 0 ? (
            <span className="font-sans text-xs text-text-ghost">Enter the guess you played, then tap its tiles to paint the colours you got</span>
          ) : canType ? (
            <span className="font-sans text-xs text-text-ghost">Tap tiles to paint feedback · gray → yellow → green</span>
          ) : (
            <span className="font-sans text-xs text-text-ghost">Six guesses used — undo one to keep exploring</span>
          )}
        </div>

        {guesses.length > 0 && (
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={undo}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border-2 border-border-default hover:border-border-strong text-text-primary font-sans text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Undo2 size={13} />
              Undo guess
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={reset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-text-secondary hover:text-text-primary font-sans text-xs font-semibold transition-colors"
            >
              <RotateCcw size={13} />
              Reset
            </motion.button>
          </div>
        )}

        {canType && <Keyboard onKey={input.onKey} onEnter={submitGuess} onBackspace={input.onBackspace} letterStates={letterStates} />}
        <ErrorLine message={error} />
      </div>

      {/* ── Evaluation ────────────────────────────────────────────────────── */}
      {!report && loading && (
        <div className="flex flex-col items-center gap-3 py-10">
          <TileSpinner size="md" label="Evaluating position" />
          <span className="font-sans text-xs text-text-secondary">Asking the engine…</span>
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: dimmed ? 0.5 : 1, y: 0 }} transition={springs.slide} className="flex flex-col gap-5">
      {solved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springs.snappy}
          className="rounded-card border px-4 py-3 flex items-center gap-3"
          style={{
            borderColor: 'color-mix(in srgb, var(--tile-correct) 40%, transparent)',
            background: 'color-mix(in srgb, var(--tile-correct) 10%, transparent)',
          }}
        >
          <MiniWord word={guesses[guesses.length - 1] ?? ''} state="correct" size={22} />
          <span className="font-display font-black tracking-tight text-base text-text-primary">
            Solved in {guesses.length}/{MAX_GUESSES}.
          </span>
          <span className="font-sans text-xs text-text-secondary">Undo a guess to see what else would have worked.</span>
        </motion.div>
      )}

      {/* Headline numbers */}
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Answers left"
          value={formatInt(report.remaining)}
          sub={impossible ? 'no answer fits — check your colours' : `of ${formatInt(ANSWERS_TOTAL)} possible answers`}
          accent={remainingAccent}
        />
        <StatTile label="Uncertainty" value={report.entropy_left.toFixed(2)} unit="bits" sub="log₂ of answers left" delay={0.04} />
        <StatTile label="Guesses" value={`${guesses.length}/${MAX_GUESSES}`} sub={guesses.length ? 'painted so far' : 'opening position'} delay={0.08} />
      </div>

      {/* Path */}
      {report.history.length > 0 && (
        <LabCard title="Your path" aside="answers before → after" padded={false}>
          <div className="divide-y divide-border-subtle">
            {report.history.map((h, i) => {
              const bits = h.remaining_after > 0 ? Math.log2(h.remaining_before / h.remaining_after) : null;
              return (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="font-display font-bold text-sm tabular-nums w-5 text-right shrink-0 text-text-ghost">{i + 1}</span>
                  <MiniPattern pattern={h.pattern} letters={h.guess} size={18} />
                  <span className="flex-1 font-mono text-xs tabular-nums text-text-secondary text-right">
                    {formatInt(h.remaining_before)} → <span className="text-text-primary font-semibold">{formatInt(h.remaining_after)}</span>
                  </span>
                  <span className="font-mono text-xs tabular-nums w-16 text-right shrink-0" style={{ color: bits == null ? 'var(--red)' : 'var(--tile-correct)' }}>
                    {bits == null ? 'impossible' : `+${bits.toFixed(2)} b`}
                  </span>
                </div>
              );
            })}
          </div>
        </LabCard>
      )}

      {impossible ? (
        <div className="rounded-card-lg border border-dashed border-border-default px-6 py-8 text-center">
          <p className="font-sans text-sm text-text-secondary">
            No answer in the list produces that feedback. Tap the tiles to fix a colour, or undo the last guess.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Top picks */}
          <LabCard
            title={solved ? 'Best next guess (if it weren’t over)' : 'What should I guess next?'}
            aside="engine’s top picks"
            padded={false}
            className="lg:col-span-3"
          >
            {report.top_picks.length === 0 ? (
              <div className="px-4 py-8 text-center font-sans text-sm text-text-secondary">Nothing to suggest.</div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-border-subtle">
                  <MicroLabel className="w-5 text-right shrink-0">#</MicroLabel>
                  <MicroLabel className="flex-1">Word</MicroLabel>
                  <MicroLabel className="w-12 text-right shrink-0">Bits</MicroLabel>
                  <MicroLabel className="w-12 text-right shrink-0">Exp.</MicroLabel>
                  <MicroLabel className="w-12 text-right shrink-0 hidden sm:block">Worst</MicroLabel>
                  <span className="w-2 shrink-0" />
                </div>
                <div className="divide-y divide-border-subtle">
                  {report.top_picks.map((p, i) => {
                    const row = (
                      <>
                        <span className="font-display font-bold text-sm tabular-nums w-5 text-right shrink-0 text-text-ghost">{i + 1}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <MiniWord word={p.word} state={i === 0 ? 'correct' : 'absent'} size={18} />
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums text-text-primary w-12 text-right shrink-0">{p.entropy.toFixed(2)}</span>
                        <span className="font-mono text-xs tabular-nums text-text-secondary w-12 text-right shrink-0">{p.expected_remaining.toFixed(1)}</span>
                        <span className="font-mono text-xs tabular-nums text-text-secondary w-12 text-right shrink-0 hidden sm:block">
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
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-bg-elevated/50 transition-colors focus-visible:outline-none focus-visible:ring-2"
                        style={{ outlineColor: 'var(--tile-correct)' }}
                        aria-label={`Type ${p.word} as the next guess`}
                      >
                        {row}
                      </button>
                    ) : (
                      <div key={p.word} className="flex items-center gap-3 px-4 py-2.5">
                        {row}
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2.5 border-t border-border-subtle flex items-center gap-2">
                  <AnswerDot on />
                  <span className="font-sans text-[11px] text-text-ghost">
                    = could be the answer.{onUse ? ' Tap a row to type it in.' : ''}
                  </span>
                </div>
              </>
            )}
          </LabCard>

          {/* Remaining words */}
          <LabCard
            title="Still possible"
            aside={report.remaining_truncated ? `showing ${report.remaining_words.length} of ${formatInt(report.remaining)}` : `${formatInt(report.remaining)} word${report.remaining === 1 ? '' : 's'}`}
            className="lg:col-span-2"
          >
            <div className="flex flex-wrap gap-1.5">
              {report.remaining_words.map((w) => (
                <Chip key={w} tone={report.remaining === 1 ? 'green' : 'neutral'} onClick={onUse ? () => onUse(w) : undefined} className={clsx(!onUse && 'cursor-default')}>
                  <span className="font-mono tracking-wider text-[11px]">{w}</span>
                </Chip>
              ))}
            </div>
            {report.remaining_truncated && (
              <p className="font-sans text-[11px] text-text-ghost mt-3">
                Too many to list — paint another guess to narrow it down.
              </p>
            )}
          </LabCard>
        </div>
      )}
    </motion.div>
  );
}
