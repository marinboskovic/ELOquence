'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

interface SeriesDef {
  key: string;
  label: string;
  /** A token: ink (`var(--text-primary)`), a tile var or `var(--accent)`. */
  color: string;
}

interface Props {
  // Per-row mixed payload (numeric series values + a `date` ISO string).
  // The default Next.js eslint config doesn't load @typescript-eslint, so
  // we don't need a suppression comment for `any` — it's not flagged.
  data: Array<Record<string, any>>;
  series: SeriesDef[];
  height?: number;
  yLabel?: string;
}

const MONO = 'var(--font-mono), ui-monospace, monospace';

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Print-style line chart: hair grid, ink/tile/accent strokes, square hover
 * markers, no area fills or gradients (DESIGN.md §7).
 */
export default function TimeSeriesChart({ data, series, height = 220, yLabel }: Props) {
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
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

  const pad = { top: 16, right: 12, bottom: 28, left: yLabel ? 52 : 40 };
  const viewW = 600;
  const plotW = viewW - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // Compute y domain across all series
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const row of data) {
    for (const s of series) {
      const v = row[s.key];
      if (typeof v === 'number') {
        if (v < yMin) yMin = v;
        if (v > yMax) yMax = v;
      }
    }
  }
  if (!isFinite(yMin)) { yMin = 0; yMax = 10; }
  if (yMin === yMax) { yMin = Math.max(0, yMin - 1); yMax = yMax + 1; }

  const xScale = (i: number) =>
    data.length < 2 ? pad.left + plotW / 2 : pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (v: number) =>
    pad.top + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const buildPath = (seriesKey: string) => {
    const pts = data
      .map((row, i) => {
        const v = row[seriesKey];
        if (typeof v !== 'number') return null;
        return `${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`;
      })
      .filter(Boolean);
    if (pts.length === 0) return '';
    return 'M ' + pts.join(' L ');
  };

  // X-axis label indices: first, middle, last
  const xLabelIndices = [0, Math.floor((data.length - 1) / 2), data.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const svgX = relX * viewW;
    if (svgX < pad.left || svgX > pad.left + plotW) {
      setHoverX(null);
      setHoverIdx(null);
      return;
    }
    const t = (svgX - pad.left) / plotW;
    const rawIdx = t * (data.length - 1);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(rawIdx)));
    setHoverX(xScale(idx));
    setHoverIdx(idx);
  };

  const tooltipW = 150;
  const tooltipH = 22 + series.length * 16 + 10;
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  let tooltipLeft = hoverX !== null ? hoverX + 10 : 0;
  if (tooltipLeft + tooltipW > viewW - pad.right) tooltipLeft = (hoverX ?? 0) - tooltipW - 10;
  tooltipLeft = Math.max(pad.left, tooltipLeft);
  const tooltipTop = pad.top;

  return (
    <div>
      <svg
        viewBox={`0 0 ${viewW} ${height}`}
        className="w-full"
        role="img"
        aria-label={`Time series chart${yLabel ? `: ${yLabel}` : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoverX(null); setHoverIdx(null); }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = pad.top + plotH * (1 - frac);
          const val = yMin + (yMax - yMin) * frac;
          return (
            <g key={frac}>
              <line
                x1={pad.left}
                y1={y}
                x2={pad.left + plotW}
                y2={y}
                stroke={frac === 0 ? 'var(--border-default)' : 'var(--border-subtle)'}
                strokeWidth={frac === 0 ? 1.5 : 1}
              />
              <text
                x={pad.left - 6}
                y={y + 3}
                fontSize={9}
                fontFamily={MONO}
                fill="var(--text-tertiary)"
                textAnchor="end"
              >
                {Number.isInteger(val) ? val : val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Y-axis label */}
        {yLabel && (
          <text
            x={8}
            y={pad.top + plotH / 2}
            fontSize={9}
            fontFamily={MONO}
            fill="var(--text-secondary)"
            textAnchor="middle"
            transform={`rotate(-90, 8, ${pad.top + plotH / 2})`}
            style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}
          >
            {yLabel}
          </text>
        )}

        {/* Series paths — strokes only */}
        {series.map((s, i) => {
          const d = buildPath(s.key);
          if (!d) return null;
          return (
            <motion.path
              key={s.key}
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={i === 0 ? 2 : 1.5}
              strokeLinecap="square"
              strokeLinejoin="miter"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: i * 0.08 }}
            />
          );
        })}

        {/* X-axis labels */}
        {xLabelIndices.map((idx) => (
          <text
            key={idx}
            x={xScale(idx)}
            y={height - 8}
            fontSize={9}
            fontFamily={MONO}
            fill="var(--text-secondary)"
            textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
          >
            {formatDateLabel(data[idx].date)}
          </text>
        ))}

        {/* Hover guide */}
        {hoverX !== null && hoverIdx !== null && hovered && (
          <>
            <line
              x1={hoverX}
              y1={pad.top}
              x2={hoverX}
              y2={pad.top + plotH}
              stroke="var(--border-default)"
              strokeWidth={1}
              pointerEvents="none"
            />
            {series.map((s) => {
              const v = hovered[s.key];
              if (typeof v !== 'number') return null;
              return (
                <rect
                  key={s.key}
                  x={hoverX - 3.5}
                  y={yScale(v) - 3.5}
                  width={7}
                  height={7}
                  fill={s.color}
                  stroke="var(--bg-base)"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              );
            })}
            <foreignObject
              x={tooltipLeft}
              y={Math.max(pad.top, tooltipTop)}
              width={tooltipW}
              height={tooltipH}
              style={{ overflow: 'visible' }}
            >
              <div
                className="border-2 border-border-default bg-bg-base shadow-ink-sm px-3 py-2 pointer-events-none"
                style={{ fontSize: 11, lineHeight: 1.5 }}
              >
                <div className="font-mono uppercase tracking-[0.14em] text-text-secondary mb-1" style={{ fontSize: 9 }}>
                  {formatDateLabel(hovered.date)}
                </div>
                {series.map((s) => {
                  const v = hovered[s.key];
                  return (
                    <div key={s.key} className="flex items-center gap-1.5">
                      <span
                        style={{
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          backgroundColor: s.color,
                          flexShrink: 0,
                        }}
                      />
                      <span className="font-sans text-text-secondary" style={{ fontSize: 10, flex: 1 }}>
                        {s.label}
                      </span>
                      <span className="font-mono font-semibold text-text-primary tabular" style={{ fontSize: 11 }}>
                        {typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(1)) : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </foreignObject>
          </>
        )}
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-text-secondary">
              <span style={{ width: 14, height: 2, background: s.color, display: 'inline-block' }} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
