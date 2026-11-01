'use client';

import { motion } from 'framer-motion';
import { TileState } from '../TileRow';

/* A single interactive tile used inside challenges: a square of paper with a
 * 2px ink rule, filled by the semantic tile colour when revealed. Highlight
 * (the "look here" state) is an accent rule — no glow.
 */

const COLOUR: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent: 'var(--tile-absent)',
  empty: 'transparent',
};

export default function GameTile({
  letter,
  state,
  size = 56,
  onClick,
  highlight = false,
}: {
  letter: string;
  state: TileState;
  size?: number;
  onClick?: () => void;
  highlight?: boolean;
}) {
  const filled = state !== 'empty';
  const fg = state === 'absent' ? 'var(--tile-absent-text)' : filled ? '#fff' : 'var(--text-primary)';
  const borderColor = highlight ? 'var(--accent)' : filled ? COLOUR[state] : 'var(--border-default)';
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={onClick ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.95 } : undefined}
      animate={{ backgroundColor: filled ? COLOUR[state] : 'rgba(0,0,0,0)' }}
      transition={{ duration: 0.3, ease: [0.7, 0, 0.2, 1] }}
      style={{
        width: size,
        height: size,
        borderRadius: 0,
        border: `2px solid ${borderColor}`,
        color: fg,
        fontSize: size * 0.46,
        fontWeight: 900,
        fontFamily: 'var(--font-display)',
        textTransform: 'uppercase',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        padding: 0,
        userSelect: 'none',
        lineHeight: 1,
        transition: 'border-color var(--dur-fast) ease',
      }}
    >
      {letter}
    </motion.button>
  );
}
