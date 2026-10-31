'use client';
import { TileState } from '@/lib/types';

const FILL: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent: 'var(--tile-absent)',
  empty: 'var(--tile-empty-bg)',
  tbd: 'var(--tile-empty-bg)',
};

interface MiniWordProps {
  word: string;
  /** Per-letter tile state; defaults to all-absent (a "lost" word). */
  states?: TileState[];
  size?: number;
}

/**
 * A 5-letter word rendered as a row of mini Wordle tiles (letters included).
 * Used by the dashboard cards for nemesis words and the favourite opener.
 */
export default function MiniWord({ word, states, size = 20 }: MiniWordProps) {
  const letters = word.toUpperCase().slice(0, 5).split('');
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={word.toUpperCase()}
    >
      {letters.map((ch, i) => {
        const state = states?.[i] ?? 'absent';
        return (
          <span
            key={i}
            aria-hidden="true"
            className="inline-flex items-center justify-center rounded-sm font-sans font-bold uppercase text-white"
            style={{
              width: size,
              height: size,
              fontSize: Math.max(9, Math.round(size * 0.55)),
              backgroundColor: FILL[state],
              lineHeight: 1,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}
