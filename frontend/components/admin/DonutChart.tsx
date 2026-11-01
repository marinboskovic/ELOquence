'use client';
import { motion } from 'framer-motion';

interface Segment {
  key: string;
  label: string;
  value: number;
  /** A token: ink, a tile var, accent or a grey. */
  color: string;
}

interface Props {
  segments: Segment[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel?: string;
}

/**
 * Ring chart with butt-capped segments separated by paper gaps, a display
 * number in the centre and a hair-ruled legend. Flat colour only.
 */
export default function DonutChart({ segments, size = 160, centerLabel, centerValue, ariaLabel }: Props) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0 || segments.length === 0) {
    return (
      <div
        className="flex items-center justify-center font-mono text-label uppercase text-text-secondary bg-bg-muted"
        style={{ height: size }}
        role="img"
        aria-label={ariaLabel ? `${ariaLabel}: no data` : 'No data available'}
      >
        no data
      </div>
    );
  }

  const descriptive = ariaLabel
    ? `${ariaLabel}: ${segments
        .map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`)
        .join(', ')}`
    : 'Donut chart';

  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const strokeW = size * 0.12;
  const circumference = 2 * Math.PI * r;
  const gapFrac = segments.length > 1 ? 0.008 : 0;

  // Build arc offsets
  const segs: Array<{ seg: Segment; offset: number; dash: number; pct: number }> = [];
  let cumulative = 0;
  for (const seg of segments) {
    const pct = seg.value / total;
    const dash = Math.max(0, pct - gapFrac) * circumference;
    const offset = circumference * (1 - cumulative);
    segs.push({ seg, offset, dash, pct });
    cumulative += pct;
  }

  return (
    <div role="img" aria-label={descriptive} className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6 items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto sm:mx-0">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={strokeW} />

        {/* Animated segments */}
        {segs.map(({ seg, offset, dash }, i) => (
          <motion.circle
            key={seg.key}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeLinecap="butt"
            strokeDasharray={`${dash} ${circumference}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${dash} ${circumference}` }}
            transition={{ duration: 0.6, delay: i * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
          />
        ))}

        {/* Center text */}
        {centerValue && (
          <text
            x={cx}
            y={cy - (centerLabel ? 6 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={size * 0.16}
            fontFamily="var(--font-display), sans-serif"
            fontWeight="900"
            letterSpacing="-0.03em"
            fill="var(--text-primary)"
          >
            {centerValue}
          </text>
        )}
        {centerLabel && (
          <text
            x={cx}
            y={cy + (centerValue ? size * 0.11 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={size * 0.065}
            fontFamily="var(--font-mono), monospace"
            letterSpacing="0.14em"
            style={{ textTransform: 'uppercase' }}
            fill="var(--text-secondary)"
          >
            {centerLabel}
          </text>
        )}
      </svg>

      {/* Legend */}
      <ul className="w-full">
        {segs.map(({ seg, pct }) => (
          <li key={seg.key} className="flex items-center gap-3 py-1.5 border-b border-border-subtle last:border-0">
            <span className="shrink-0" style={{ width: 10, height: 10, backgroundColor: seg.color }} aria-hidden="true" />
            <span className="font-sans text-sm text-text-secondary flex-1 min-w-0 truncate">{seg.label}</span>
            <span className="font-mono text-sm tabular text-text-primary">{seg.value.toLocaleString()}</span>
            <span className="font-mono text-xs tabular text-text-tertiary w-9 text-right">{(pct * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
