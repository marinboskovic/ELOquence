'use client';
import { TileState } from '@/lib/types';
import { MiniTiles } from '@/components/ui';

interface MiniWordProps {
  word: string;
  /** Per-letter tile state; defaults to all-absent (a "lost" word). */
  states?: TileState[];
  size?: number;
}

/**
 * A 5-letter word rendered as a row of mini tiles (letters included).
 * Thin wrapper over the UI kit's `MiniTiles` so the dashboard, profile and
 * leaderboard share one tile vocabulary.
 */
export default function MiniWord({ word, states, size = 22 }: MiniWordProps) {
  const upper = word.toUpperCase().slice(0, 5);
  const mapped = states?.map((s) => (s === 'tbd' ? 'empty' : s)) as
    | ('correct' | 'present' | 'absent' | 'empty')[]
    | undefined;
  return (
    <span role="img" aria-label={upper} className="inline-flex">
      <MiniTiles word={upper} states={mapped} size={size} />
    </span>
  );
}
