'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';

interface Props {
  distribution: Record<string, number>;
  losses: number;
  highlight?: number;
}

const ROWS: Array<{ key: string; label: string }> = [
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: '3', label: '3' },
  { key: '4', label: '4' },
  { key: '5', label: '5' },
  { key: '6', label: '6' },
  { key: 'X', label: 'X' },
];

/**
 * Horizontal ink bars on a hair-ruled ledger. The most frequent row (or the
 * explicitly highlighted one) is set in the semantic "correct" tile colour;
 * every other bar is plain ink. Labels and counts are mono.
 */
export default function GuessDistribution({ distribution, losses, highlight }: Props) {
  const counts: Record<string, number> = {
    ...distribution,
    X: losses,
  };

  const maxCount = Math.max(1, ...Object.values(counts));
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const highlightKey =
    highlight !== undefined
      ? highlight > 6
        ? 'X'
        : String(highlight)
      : undefined;

  // "Best" bar: the mode of the won-guess distribution (ties → fewest guesses).
  const bestKey =
    highlightKey ??
    ROWS.filter((r) => r.key !== 'X' && (counts[r.key] ?? 0) > 0).reduce<string | undefined>((best, r) => {
      if (best === undefined) return r.key;
      return (counts[r.key] ?? 0) > (counts[best] ?? 0) ? r.key : best;
    }, undefined);

  return (
    <div className="flex flex-col" role="img" aria-label="Guess distribution chart">
      {ROWS.map(({ key, label }, rowIdx) => {
        const count = counts[key] ?? 0;
        const isBest = bestKey === key && count > 0;
        const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;

        return (
          <div key={key} className="rule-hair grid items-center gap-3 py-1.5" style={{ gridTemplateColumns: '1.5rem 1fr 2.5rem' }}>
            {/* Label column — mono */}
            <span className={clsx('font-mono text-xs tabular text-right', isBest ? 'text-text-primary font-semibold' : 'text-text-secondary')}>
              {label}
            </span>

            {/* Bar */}
            <div className="relative h-4 min-w-0">
              {count === 0 ? (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-px w-2 bg-text-ghost" aria-hidden="true" />
              ) : (
                <motion.div
                  className={clsx('absolute inset-y-0 left-0', isBest ? '' : 'bg-bg-ink')}
                  style={isBest ? { backgroundColor: 'var(--tile-correct)' } : undefined}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(pct, 1.5)}%` }}
                  transition={{ duration: 0.48, delay: rowIdx * 0.05, ease: [0.7, 0, 0.2, 1] }}
                />
              )}
            </div>

            {/* Count — mono, right-aligned */}
            <span className={clsx('font-mono text-xs tabular text-right', count === 0 ? 'text-text-tertiary' : 'text-text-primary')}>
              {count}
            </span>
          </div>
        );
      })}

      <div className="rule-hair pt-2 flex items-center justify-between">
        <span className="font-mono text-label uppercase text-text-tertiary">
          {total} game{total !== 1 ? 's' : ''}
        </span>
        {bestKey && (counts[bestKey] ?? 0) > 0 && (
          <span className="font-mono text-label uppercase text-text-tertiary">
            most often · {bestKey === 'X' ? 'x' : `${bestKey}/6`}
          </span>
        )}
      </div>
    </div>
  );
}
