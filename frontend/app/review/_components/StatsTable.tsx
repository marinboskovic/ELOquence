'use client';
/**
 * Detailed view: the per-guess numbers table. Every column header is a
 * `<Hint>` so the terms explain themselves.
 */
import clsx from 'clsx';
import { Hint, Label } from '@/components/ui';
import type { MoveAnalysis } from '@/lib/types';
import { SOLVED_PATTERN } from './insights';

export default function StatsTable({ moves, activeRow }: { moves: MoveAnalysis[]; activeRow: number }) {
  const COLS = '2.5rem repeat(4, 1fr)';
  return (
    <div className="w-full min-w-0">
      <div className="rule-top grid gap-x-2 sm:gap-x-4 pt-2 pb-1.5 items-end" style={{ gridTemplateColumns: COLS }}>
        <Label>#</Label>
        <Label className="text-right">
          <Hint term="skill" />
        </Label>
        <Label className="text-right">
          <Hint term="luck" />
        </Label>
        <Label className="text-right">
          <Hint term="wordsLeft">
            <span className="sm:hidden">Left</span>
            <span className="hidden sm:inline">Words left</span>
          </Hint>
        </Label>
        <Label className="text-right">
          <Hint term="information">
            <span className="sm:hidden">Bits</span>
            <span className="hidden sm:inline">Narrowing (bits)</span>
          </Hint>
        </Label>
      </div>
      <div className="flex flex-col">
        {moves.map((m, i) => {
          const isActive = i === activeRow;
          const bitsGained = m.info_gained ?? 0;
          const wordsLeft = m.pattern === SOLVED_PATTERN ? '—' : String(m.remaining_after ?? '—');
          return (
            <div
              key={i}
              className={clsx(
                'grid gap-x-2 sm:gap-x-4 py-1.5 border-b border-border-subtle hover:bg-bg-elevated transition-colors duration-fast',
                isActive && 'bg-bg-elevated'
              )}
              style={{ gridTemplateColumns: COLS }}
            >
              <span className={clsx('font-mono text-xs tabular', isActive ? 'text-accent' : 'text-text-tertiary')}>{i + 1}</span>
              {[String(m.skill_score ?? '—'), String(m.luck_score ?? '—'), wordsLeft, bitsGained.toFixed(1)].map((val, j) => (
                <span key={j} className="font-mono font-semibold tabular text-sm text-right text-text-primary">
                  {val}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
