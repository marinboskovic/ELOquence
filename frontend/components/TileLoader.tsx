'use client';

import { motion } from 'framer-motion';

/* Three small ELOquence tiles that cycle through the tile palette
 * (absent → present → correct) with a square ink-fill rhythm. Replaces
 * the generic spinning circle for full-page loading states so the wait
 * still feels on-brand. Radius 0, like every tile (DESIGN.md §3).
 *
 * Reach for the plain spinner inside buttons or other compact CTAs —
 * this loader is centre-of-screen scale and would look out of place
 * inline.
 */

const COLORS = [
  'var(--tile-absent)',
  'var(--tile-present)',
  'var(--tile-correct)',
  'var(--tile-absent)',
];

interface TileLoaderProps {
  /** Edge length of each tile in pixels. Defaults to 18px. */
  size?: number;
  /** Accessible label announced to screen readers. */
  label?: string;
  /** Extra classes for the wrapping flex container. */
  className?: string;
}

export default function TileLoader({
  size = 18,
  label = 'Loading',
  className = '',
}: TileLoaderProps) {
  const gap = Math.max(3, Math.round(size / 5));
  return (
    <div
      className={`flex items-center ${className}`}
      style={{ gap }}
      role="status"
      aria-label={label}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          aria-hidden
          style={{
            width: size,
            height: size,
            borderRadius: 0,
            display: 'inline-block',
            backgroundColor: 'var(--tile-absent)',
            transformOrigin: 'bottom center',
          }}
          animate={{
            scaleY: [0.78, 1, 1, 0.78],
            backgroundColor: COLORS,
          }}
          transition={{
            duration: 1.4,
            ease: 'easeInOut',
            repeat: Infinity,
            delay: i * 0.16,
            times: [0, 0.35, 0.7, 1],
          }}
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
