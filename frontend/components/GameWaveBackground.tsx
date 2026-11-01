'use client';
import { useMemo } from 'react';
import { patternToTiles } from '@/lib/types';
import type { GameStatus } from '@/lib/types';

interface GameWaveBackgroundProps {
  patterns: number[];
  status: GameStatus;
  triggerKey: number;
  lastPattern: number | null;
}

type Wash = 'none' | 'green' | 'ochre' | 'accent';

/**
 * Picks the paper tint for the board screen from the last revealed row:
 * mostly-green → green wash, mostly-yellow → ochre wash, a dead row → plain
 * paper. Win and loss settle on green / accent. Only the four wash tokens are
 * used, so dark mode and colour-blind mode need no special handling.
 */
function pickWash(patterns: number[], status: GameStatus, lastPattern: number | null): Wash {
  if (status === 'won') return 'green';
  if (status === 'lost') return 'accent';
  if (lastPattern === null || patterns.length === 0) return 'none';
  const tiles = patternToTiles(lastPattern);
  const g = tiles.filter((t) => t === 'correct').length;
  const y = tiles.filter((t) => t === 'present').length;
  if (g === 0 && y === 0) return 'none';
  return g >= y ? 'green' : 'ochre';
}

const WASH_VAR: Record<Exclude<Wash, 'none'>, string> = {
  green: 'var(--wash-green)',
  ochre: 'var(--wash-ochre)',
  accent: 'var(--wash-accent)',
};

/**
 * A very quiet tint behind the board that shifts with the last pattern.
 * No gradients, no blur — one flat wash token at low opacity, cross-faded
 * with a plain CSS transition (which the global reduce-motion rules zero).
 */
export default function GameWaveBackground({ patterns, status, lastPattern }: GameWaveBackgroundProps) {
  const wash = useMemo(() => pickWash(patterns, status, lastPattern), [patterns, status, lastPattern]);
  const strong = status !== 'in_progress';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        backgroundColor: wash === 'none' ? 'transparent' : WASH_VAR[wash],
        opacity: wash === 'none' ? 0 : strong ? 1 : 0.55,
        transition: 'background-color var(--dur-slow) var(--ease-ink), opacity var(--dur-slow) var(--ease-ink)',
      }}
    />
  );
}
