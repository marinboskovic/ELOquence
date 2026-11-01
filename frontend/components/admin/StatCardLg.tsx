'use client';
import React from 'react';
import { Stat } from '@/components/ui';

interface TrendInfo {
  value: number;
  direction: 'up' | 'down' | 'neutral';
}

interface Props {
  label: string;
  value: string | number;
  /** Kept for call-site compatibility; the Atelier Stat carries no icon. */
  icon?: React.ElementType;
  sparkline?: number[];
  trend?: TrendInfo;
  /** Kept for compatibility; colour is no longer per-card (one accent per surface). */
  accent?: 'green' | 'red' | 'gold' | 'default';
  size?: 'sm' | 'md' | 'lg';
}

/** 14-point ink line, no fill, no gradient — a print sparkline. */
function MicroSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 96;
  const h = 24;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 2) + 1;
    const y = h - 2 - ((v - min) / range) * (h - 4);
    return [x, y] as const;
  });
  const d = 'M ' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke="var(--text-primary)" strokeWidth={1.5} strokeLinejoin="miter" />
      <rect x={lx - 2} y={ly - 2} width={4} height={4} fill="var(--accent)" />
    </svg>
  );
}

/**
 * Large admin stat: the shared `<Stat>` (label over display number, hair
 * rule above) with an optional trend figure and sparkline as its sub-line.
 */
export default function StatCardLg({ label, value, sparkline, trend, size = 'md' }: Props) {
  const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  const countable = typeof value === 'number' || (/^[\d,]+$/.test(String(value)) && Number.isFinite(numeric));

  const sub =
    trend || (sparkline && sparkline.length >= 2) ? (
      <span className="flex items-center justify-between gap-3">
        {trend ? (
          <span className="font-mono tabular text-text-secondary">
            {trend.direction === 'up' ? '▲' : trend.direction === 'down' ? '▼' : '—'} {Math.abs(trend.value).toFixed(1)}%
          </span>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length >= 2 && <MicroSparkline values={sparkline} />}
      </span>
    ) : undefined;

  return <Stat label={label} value={countable ? numeric : value} sub={sub} size={size} />;
}
