'use client';
import { motion } from 'framer-motion';
import { TileState } from '@/lib/types';
import clsx from 'clsx';

interface TileProps {
  letter?: string;
  state: TileState;
  position?: number;
  /** When true this tile is animating its reveal right now */
  isFlipping?: boolean;
  /** Seconds to delay before starting the reveal */
  flipDelay?: number;
  /** Override the CSS size (defaults to --tile-size) */
  size?: string;
  className?: string;
}

const INK: Record<Exclude<TileState, 'empty' | 'tbd'>, { ink: string; fg: string }> = {
  correct: { ink: 'var(--tile-correct)', fg: '#ffffff' },
  present: { ink: 'var(--tile-present)', fg: '#ffffff' },
  absent: { ink: 'var(--tile-absent)', fg: 'var(--tile-absent-text)' },
};

/**
 * Atelier tile: a square of paper with a 2px ink rule. Revealed tiles are
 * filled by "ink pouring in" from the bottom edge (CSS `.tile-ink`), not a
 * 3D flip — see DESIGN.md §4/§5.
 */
export default function Tile({
  letter = '',
  state,
  position = 0,
  isFlipping = false,
  flipDelay = 0,
  size,
  className,
}: TileProps) {
  const isRevealed = state === 'correct' || state === 'present' || state === 'absent';
  const isTbd = state === 'tbd' && letter !== '';

  const ariaLabel = letter
    ? `${letter}, ${state === 'tbd' ? 'pending' : state}, position ${position + 1}`
    : `empty, position ${position + 1}`;

  const dim = size ?? 'var(--tile-size)';

  let style: React.CSSProperties = {
    width: dim,
    height: dim,
    border: '2px solid var(--tile-empty-border)',
    color: 'var(--text-primary)',
    backgroundColor: 'var(--tile-empty-bg)',
  };
  if (isTbd) style = { ...style, borderColor: 'var(--tile-tbd-border)' };
  if (isRevealed) {
    const { ink, fg } = INK[state];
    style = isFlipping
      ? {
          ...style,
          borderColor: 'var(--tile-tbd-border)',
          ['--ink' as string]: ink,
          ['--ink-fg' as string]: fg,
          ['--tile-size' as string]: dim,
          animationDelay: `${flipDelay}s`,
        }
      : { ...style, backgroundColor: ink, borderColor: ink, color: fg };
  }

  return (
    <motion.div
      key={`${letter}-${state}`}
      role="img"
      aria-label={ariaLabel}
      initial={isTbd ? { scale: 0.88 } : false}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', damping: 18, stiffness: 700, mass: 0.3 }}
      className={clsx(
        'flex items-center justify-center select-none font-display font-black uppercase',
        isFlipping && isRevealed && 'tile-ink',
        className
      )}
      style={{ ...style, fontSize: `calc(${dim} * 0.46)`, lineHeight: 1 }}
    >
      {letter}
    </motion.div>
  );
}
