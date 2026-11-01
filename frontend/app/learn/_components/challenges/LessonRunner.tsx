'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, RefreshCcw, X } from 'lucide-react';
import { Button, CountUp, Label } from '@/components/ui';
import TileTap from './TileTap';
import TilePaint from './TilePaint';
import MultipleChoice from './MultipleChoice';
import GuessTheNext from './GuessTheNext';
import RevealCard from './RevealCard';
import WordSurvivors from './WordSurvivors';
import SortIntoBuckets from './SortIntoBuckets';
import PoolShrink from './PoolShrink';
import LetterPicker from './LetterPicker';
import Confetti from './Confetti';
import type { Challenge, Lesson } from './types';

/* Orchestrates a sequence of mini-challenges that make up one lesson.
 *
 * Flow:
 *   1. User sees the first challenge.
 *   2. Each challenge calls `onResolve(correct: boolean)`.
 *   3. If correct → confetti + advance to next.
 *   4. If wrong → child handles its own feedback; we wait for it to
 *      re-resolve. Optional "hearts" mechanic: each wrong burns a heart;
 *      0 hearts → lesson restarts (TODO future).
 *   5. After last challenge → success screen with XP gain + Continue.
 */

interface Props {
  lesson: Lesson;
  onComplete: () => void;
  /** Called after every successful challenge with the new high-water mark
   *  of completed challenges in this lesson. Parent persists for colour-coding. */
  onProgress?: (challengesCompleted: number) => void;
}

function ChallengeView({ challenge, onResolve }: { challenge: Challenge; onResolve: (correct: boolean) => void }) {
  switch (challenge.kind) {
    case 'tile-tap':
      return <TileTap challenge={challenge} onResolve={onResolve} />;
    case 'tile-paint':
      return <TilePaint challenge={challenge} onResolve={onResolve} />;
    case 'multiple-choice':
      return <MultipleChoice challenge={challenge} onResolve={onResolve} />;
    case 'guess-next':
      return <GuessTheNext challenge={challenge} onResolve={onResolve} />;
    case 'reveal':
      return <RevealCard challenge={challenge} onResolve={onResolve} />;
    case 'word-survivors':
      return <WordSurvivors challenge={challenge} onResolve={onResolve} />;
    case 'sort-buckets':
      return <SortIntoBuckets challenge={challenge} onResolve={onResolve} />;
    case 'pool-shrink':
      return <PoolShrink challenge={challenge} onResolve={onResolve} />;
    case 'letter-picker':
      return <LetterPicker challenge={challenge} onResolve={onResolve} />;
  }
}

export default function LessonRunner({ lesson, onComplete, onProgress }: Props) {
  const [idx, setIdx] = useState(0);
  const [confettiTick, setConfettiTick] = useState(0);
  const [done, setDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const total = lesson.challenges.length;
  const current = lesson.challenges[idx];

  // Reset state when the lesson changes (e.g. navigation back to it).
  useEffect(() => {
    setIdx(0);
    setDone(false);
    setCorrectCount(0);
  }, [lesson.id]);

  const handleResolve = useCallback(
    (correct: boolean) => {
      if (correct) {
        setConfettiTick((t) => t + 1);
        setCorrectCount((c) => {
          const next = c + 1;
          // Report to parent so it can persist partial progress for colouring.
          onProgress?.(next);
          return next;
        });
        // Advance after a brief beat — long enough to read confetti
        setTimeout(() => {
          if (idx + 1 >= total) {
            setDone(true);
          } else {
            setIdx((i) => i + 1);
          }
        }, 850);
      }
      // Wrong: child handles its own retry UI; runner does nothing.
    },
    [idx, total, onProgress],
  );

  function restart() {
    setIdx(0);
    setDone(false);
    setCorrectCount(0);
  }

  // ── Done screen: the lesson's one ink block ──────────────────
  if (done) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
        className="bg-bg-ink text-text-on-ink px-6 md:px-10 py-10 md:py-14 flex flex-col gap-6"
      >
        <Label className="text-text-on-ink opacity-70">{lesson.title} · complete</Label>
        <h2 className="font-display text-display-lg text-text-on-ink">Lesson complete.</h2>
        <div className="flex items-baseline gap-3">
          <span className="font-display text-display-md tabular text-text-on-ink">
            <CountUp value={correctCount} /> / {total}
          </span>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-text-on-ink opacity-70">on first try</span>
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          <Button variant="primary" onClick={onComplete}>
            Next lesson <ChevronRight size={14} aria-hidden="true" />
          </Button>
          <Button variant="secondary" onClick={restart} className="border-text-on-ink text-text-on-ink">
            <RefreshCcw size={13} aria-hidden="true" /> Practice again
          </Button>
        </div>
      </motion.div>
    );
  }

  // ── Active challenge ──────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 relative">
      {/* Top bar — close + lesson label + progress rule + counter */}
      <div className="flex items-center gap-4">
        <button
          onClick={onComplete}
          aria-label="Close lesson"
          className="w-8 h-8 -ml-2 inline-flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors duration-fast"
        >
          <X size={18} aria-hidden="true" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <Label className="truncate">{lesson.title}</Label>
            <span className="font-mono text-xs tabular text-text-tertiary shrink-0">
              {idx + 1}/{total}
            </span>
          </div>
          <div className="relative h-[2px] w-full">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-subtle" aria-hidden="true" />
            <motion.div
              className="absolute inset-y-0 left-0 w-full origin-left bg-bg-ink"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: (idx + (done ? 1 : 0)) / total }}
              transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={idx}
            />
          </div>
        </div>
      </div>

      {/* Challenge body */}
      <div className="relative rule-top pt-8" style={{ minHeight: 360 }}>
        <Confetti trigger={confettiTick} />
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <ChallengeView challenge={current} onResolve={handleResolve} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
