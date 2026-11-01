'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, RotateCcw } from 'lucide-react';
import GameTile from './Tile';
import { scoreGuess, patternsEqual } from './score';
import type { TilePaintChallenge } from './types';
import type { TileState } from '../TileRow';

/* User taps each tile to cycle through colours, then submits. We compare
 * against the true pattern for the given target. Encourages active
 * reading of Wordle scoring rules including duplicate-letter quirks.
 */

const CYCLE: TileState[] = ['absent', 'present', 'correct'];

function nextState(s: TileState): TileState {
  const idx = CYCLE.indexOf(s);
  return CYCLE[(idx + 1) % CYCLE.length];
}

export default function TilePaint({
  challenge,
  onResolve,
}: {
  challenge: TilePaintChallenge;
  onResolve: (correct: boolean) => void;
}) {
  const [user, setUser] = useState<TileState[]>(['absent', 'absent', 'absent', 'absent', 'absent']);
  const [outcome, setOutcome] = useState<'correct' | 'wrong' | null>(null);
  const truth = scoreGuess(challenge.guess, challenge.target);

  function tap(i: number) {
    if (outcome === 'correct') return;
    setOutcome(null);
    setUser((prev) => prev.map((s, idx) => (idx === i ? nextState(s) : s)));
  }

  function submit() {
    const ok = patternsEqual(user, truth);
    setOutcome(ok ? 'correct' : 'wrong');
    if (ok) setTimeout(() => onResolve(true), 900);
  }

  function reset() {
    setUser(['absent', 'absent', 'absent', 'absent', 'absent']);
    setOutcome(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0' }}>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0, textAlign: 'center', lineHeight: 1.15, textWrap: 'balance' }}>
        {challenge.prompt}
      </p>

      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        You guessed {challenge.guess} · target is {challenge.target}
      </div>

      <motion.div
        style={{ display: 'flex', gap: 8 }}
        animate={outcome === 'wrong' ? { x: [0, -6, 6, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
      >
        {challenge.guess.split('').map((letter, i) => (
          <GameTile
            key={i}
            letter={letter}
            state={outcome === 'wrong' ? truth[i] : user[i]}
            onClick={outcome === 'correct' ? undefined : () => tap(i)}
            size={62}
          />
        ))}
      </motion.div>

      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: 0 }}>
        Tap each tile to cycle: gray → yellow → green
      </p>

      <div style={{ display: 'flex', gap: 8 }}>
        {outcome === 'wrong' && (
          <button
            type="button"
            onClick={reset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 0,
              border: '1px solid var(--border-default)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={14} /> Try again
          </button>
        )}
        {outcome !== 'correct' && (
          <button
            type="button"
            onClick={submit}
            style={{
              padding: '8px 18px',
              borderRadius: 0,
              border: 'none',
              background: 'var(--accent)',
              color: 'var(--accent-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            Submit
          </button>
        )}
      </div>

      <AnimatePresence>
        {outcome && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 0,
              background:
                outcome === 'correct'
                  ? 'var(--wash-green)'
                  : 'var(--wash-accent)',
              color: outcome === 'correct' ? 'var(--tile-correct)' : 'var(--cls-red)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {outcome === 'correct' ? <Check size={16} /> : <X size={16} />}
            {outcome === 'correct'
              ? challenge.successNote || 'Correct'
              : 'Not quite — the real pattern is shown above'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
