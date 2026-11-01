'use client';
import { motion } from 'framer-motion';

interface Props {
  buckets: Array<{ label: string; count: number }>;
  height?: number;
  /** Bar colour token; defaults to ink. */
  color?: string;
  /** Index of the bar to pick out in accent. */
  highlight?: number;
}

/**
 * Ink bars on a hair baseline. Square corners, no gradients; the one
 * highlighted bucket (if any) is the accent.
 */
export default function Histogram({ buckets, height = 180, color = 'var(--text-primary)', highlight }: Props) {
  if (!buckets || buckets.length === 0) {
    return (
      <div
        className="flex items-center justify-center font-mono text-label uppercase text-text-secondary bg-bg-muted"
        style={{ height }}
        role="img"
        aria-label="No data available"
      >
        no data
      </div>
    );
  }

  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const labelRotate = buckets.length > 10;
  const plotH = height - 44;

  return (
    <div role="img" aria-label="Histogram chart" style={{ height }} className="flex flex-col">
      <div className="flex items-end gap-[3px] flex-1 border-b-2 border-border-default" style={{ height: plotH }}>
        {buckets.map((b, i) => {
          const pct = (b.count / maxCount) * 100;
          const isHighlighted = highlight === i;
          const barH = Math.max(2, (pct / 100) * (plotH - 16));
          return (
            <div key={i} className="flex-1 min-w-0 flex flex-col items-center justify-end gap-1">
              {b.count > 0 && (
                <span className="font-mono tabular text-text-secondary" style={{ fontSize: 9, lineHeight: 1 }}>
                  {b.count}
                </span>
              )}
              <motion.div
                className="w-full"
                style={{ backgroundColor: isHighlighted ? 'var(--accent)' : color, opacity: isHighlighted ? 1 : 0.9 }}
                initial={{ height: 2 }}
                animate={{ height: barH }}
                transition={{ duration: 0.5, delay: i * 0.03, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px] mt-1.5">
        {buckets.map((b, i) => (
          <span
            key={i}
            className="flex-1 min-w-0 font-mono text-text-secondary text-center overflow-hidden text-ellipsis"
            style={{
              fontSize: 9,
              lineHeight: 1.2,
              transform: labelRotate ? 'rotate(-45deg) translateX(-4px)' : 'none',
              transformOrigin: 'top center',
              whiteSpace: 'nowrap',
            }}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
