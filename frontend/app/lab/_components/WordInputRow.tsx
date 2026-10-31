'use client';
import { motion } from 'framer-motion';
import Tile from '@/components/Tile';
import { TileState } from '@/lib/types';

interface WordInputRowProps {
  /** Current typed letters (0–5). */
  word: string;
  /** True for ~450ms after an invalid submit — plays the game-board shake. */
  shaking: boolean;
  /** Pulse the row while a request is in flight. */
  busy?: boolean;
  label?: string;
}

/**
 * The game-board's active row, lifted out for the Lab: five full-size
 * tiles in `tbd` (typed) / `empty` state, shaking on invalid input.
 */
export default function WordInputRow({ word, shaking, busy = false, label = 'Word input' }: WordInputRowProps) {
  const letters = word.split('');
  const states: TileState[] = Array.from({ length: 5 }, (_, i) => (letters[i] ? 'tbd' : 'empty'));

  return (
    <motion.div
      role="row"
      aria-label={label}
      className="flex"
      style={{ gap: 'var(--tile-gap)' }}
      animate={
        shaking
          ? { x: [0, -8, 8, -6, 6, -3, 3, 0], opacity: 1 }
          : busy
          ? { opacity: [1, 0.4, 1], x: 0 }
          : { x: 0, opacity: 1 }
      }
      transition={
        shaking
          ? { duration: 0.45, ease: 'easeInOut' }
          : busy
          ? { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }
          : { duration: 0 }
      }
    >
      {states.map((state, i) => (
        <div key={i} role="gridcell">
          <Tile letter={letters[i] ?? ''} state={state} position={i} />
        </div>
      ))}
    </motion.div>
  );
}
