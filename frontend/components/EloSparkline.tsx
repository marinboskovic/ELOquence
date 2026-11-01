'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { EloHistoryEntry } from '@/lib/types';

interface Props {
  data: EloHistoryEntry[];
  width?: number;
  height?: number;
}

const TIER_THRESHOLDS = [800, 1200, 1400, 1600];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Atelier sparkline: a crisp 1.5px ink line over a hair grid, the latest
 * point marked in accent. No area fill, no gradient. The line draws itself
 * on mount (pathLength 0 → 1) — the dashboard's signature moment.
 */
export default function EloSparkline({ data: rawData, width = 600, height = 200 }: Props) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (rawData.length === 0) {
    return (
      <div
        className="rule-hair flex items-center justify-center font-mono text-label uppercase text-text-tertiary"
        style={{ height }}
        role="img"
        aria-label="No rating history yet"
      >
        no rating history yet
      </div>
    );
  }

  // With a single entry we synthesize a "baseline" point at the first
  // entry's elo_before, recorded just before the first game, so the chart
  // has two points to draw and the user sees their actual trajectory
  // (e.g. 1000 → 1051) instead of an empty-state message.
  const data: EloHistoryEntry[] =
    rawData.length === 1
      ? [
          {
            ...rawData[0],
            elo_after: rawData[0].elo_before,
            delta: 0,
            recorded_at: new Date(
              new Date(rawData[0].recorded_at).getTime() - 1000,
            ).toISOString(),
          },
          rawData[0],
        ]
      : rawData;

  const pad = { top: 16, right: 16, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const elos = data.map((d) => d.elo_after);
  const rawMin = Math.min(...elos);
  const rawMax = Math.max(...elos);
  const range = rawMax - rawMin || 100;
  const minElo = Math.floor((rawMin - range * 0.05) / 50) * 50;
  const maxElo = Math.ceil((rawMax + range * 0.05) / 50) * 50;

  const xScale = (i: number) => pad.left + (i / (data.length - 1)) * plotW;
  const yScale = (elo: number) => pad.top + plotH - ((elo - minElo) / (maxElo - minElo)) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(d.elo_after).toFixed(1)}`)
    .join(' ');

  // Hair grid: four horizontal rules between min and max.
  const gridRows = 4;
  const gridYs = Array.from({ length: gridRows + 1 }, (_, i) => pad.top + (plotH / gridRows) * i);

  const visibleThresholds = TIER_THRESHOLDS.filter((t) => t > minElo && t < maxElo);

  const hovered = hoverIndex !== null ? data[hoverIndex] : null;
  const tooltipX = hoverIndex !== null ? xScale(hoverIndex) : 0;
  const tooltipY = hovered ? yScale(hovered.elo_after) : 0;
  const tooltipBoxW = 112;
  const tooltipBoxH = 40;
  let tooltipLeft = tooltipX - tooltipBoxW / 2;
  tooltipLeft = Math.max(pad.left, Math.min(tooltipLeft, width - pad.right - tooltipBoxW));
  const tooltipTop = tooltipY - tooltipBoxH - 10;

  const lastX = xScale(data.length - 1);
  const lastY = yScale(elos[elos.length - 1]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full block"
      role="img"
      aria-label={`ELO rating history from ${elos[0]} to ${elos[elos.length - 1]}`}
      onMouseLeave={() => setHoverIndex(null)}
      style={{ fontFamily: 'var(--font-mono), ui-monospace, monospace' }}
    >
      {/* Hair grid */}
      {gridYs.map((y, i) => (
        <line
          key={`g${i}`}
          x1={pad.left}
          y1={y}
          x2={pad.left + plotW}
          y2={y}
          stroke="var(--border-subtle)"
          strokeWidth={1}
          shapeRendering="crispEdges"
        />
      ))}
      {/* Left axis rule */}
      <line
        x1={pad.left}
        y1={pad.top}
        x2={pad.left}
        y2={pad.top + plotH}
        stroke="var(--border-subtle)"
        strokeWidth={1}
        shapeRendering="crispEdges"
      />

      {/* Tier thresholds — dotted hair with a mono tag */}
      {visibleThresholds.map((t) => {
        const y = yScale(t);
        return (
          <g key={t}>
            <line
              x1={pad.left}
              y1={y}
              x2={pad.left + plotW}
              y2={y}
              stroke="var(--text-ghost)"
              strokeWidth={1}
              strokeDasharray="2 4"
              shapeRendering="crispEdges"
            />
            <text x={pad.left + plotW} y={y - 4} fontSize={9} fill="var(--text-tertiary)" textAnchor="end" letterSpacing="0.1em">
              {t}
            </text>
          </g>
        );
      })}

      {/* The line — draws itself on mount */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="var(--text-primary)"
        strokeWidth={1.5}
        strokeLinecap="square"
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
      />

      {/* Last point — the live indicator, in accent */}
      <motion.circle
        cx={lastX}
        cy={lastY}
        r={4}
        fill="var(--accent)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
      />

      {/* Invisible hit areas for hover */}
      {data.map((_, i) => {
        const x = xScale(i);
        const slotW = plotW / (data.length - 1);
        return (
          <rect
            key={i}
            x={x - slotW / 2}
            y={pad.top}
            width={slotW}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        );
      })}

      {/* Hover rule + point + tooltip */}
      {hoverIndex !== null && hovered && (
        <>
          <line
            x1={tooltipX}
            y1={pad.top}
            x2={tooltipX}
            y2={pad.top + plotH}
            stroke="var(--border-default)"
            strokeWidth={1}
            shapeRendering="crispEdges"
          />
          <circle cx={tooltipX} cy={tooltipY} r={4} fill="var(--bg-base)" stroke="var(--border-default)" strokeWidth={1.5} />
          <foreignObject
            x={tooltipLeft}
            y={Math.max(pad.top, tooltipTop)}
            width={tooltipBoxW}
            height={tooltipBoxH}
            style={{ overflow: 'visible' }}
          >
            <div
              className="border-2 border-border-default bg-bg-base shadow-ink-sm px-2.5 py-1.5 pointer-events-none"
              style={{ fontSize: 11, lineHeight: 1.3 }}
            >
              <div className="font-mono text-text-secondary uppercase tracking-[0.1em]" style={{ fontSize: 9 }}>
                {formatDate(hovered.recorded_at)}
              </div>
              <div className="font-display font-bold tabular text-text-primary" style={{ fontSize: 14 }}>
                {hovered.elo_after}
                {hovered.delta !== 0 && (
                  <span
                    className="ml-1.5 font-mono font-normal"
                    style={{
                      fontSize: 10,
                      color: hovered.delta > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}
                  >
                    {hovered.delta > 0 ? '+' : ''}
                    {hovered.delta}
                  </span>
                )}
              </div>
            </div>
          </foreignObject>
        </>
      )}

      {/* Y-axis labels */}
      <text x={pad.left - 8} y={pad.top + 3} fontSize={9} fill="var(--text-tertiary)" textAnchor="end">
        {maxElo}
      </text>
      <text x={pad.left - 8} y={pad.top + plotH + 3} fontSize={9} fill="var(--text-tertiary)" textAnchor="end">
        {minElo}
      </text>

      {/* X-axis labels */}
      <text x={pad.left} y={height - 6} fontSize={9} fill="var(--text-tertiary)" textAnchor="start" letterSpacing="0.1em">
        {formatDate(data[0].recorded_at).toUpperCase()}
      </text>
      <text x={pad.left + plotW} y={height - 6} fontSize={9} fill="var(--text-tertiary)" textAnchor="end" letterSpacing="0.1em">
        {formatDate(data[data.length - 1].recorded_at).toUpperCase()}
      </text>
    </svg>
  );
}
