'use client';

import clsx from 'clsx';
import { projectEloByOutcome } from '@/lib/elo';
import type { Game } from '@/lib/types';
import { Label } from '@/components/ui';

/**
 * Renders a 7-cell ledger showing the ELO delta the player WOULD have
 * received for each possible game outcome (solved in 1..6 guesses, or
 * failed = X/6), holding their actual accuracy and time fixed. The cell
 * matching the actual result is marked with an accent rule.
 *
 * Only sensible for rated games where we have a player ELO + word ELO;
 * the parent should gate the render on `game.rated` and the presence
 * of those fields. We accept the Game object directly to keep the
 * call-site minimal.
 */
export default function EloProjection({
  game,
  accuracy,
}: {
  game: Game;
  accuracy: number;
}) {
  if (
    !game.rated ||
    game.elo_before == null ||
    game.word_difficulty == null
  ) {
    return null;
  }

  const rows = projectEloByOutcome({
    playerElo: game.elo_before,
    wordElo: game.word_difficulty,
    accuracy,
    timeSeconds: game.time_seconds ?? null,
    includeTime: game.mode === 'competitive',
    isPlacement: game.is_placement,
    actualNumGuesses: game.num_guesses,
    actualWon: game.status === 'won',
  });

  return (
    <section aria-label="ELO distribution" className="rule-top pt-3">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <Label>elo by outcome</Label>
        <Label className="text-text-tertiary">same accuracy · same time</Label>
      </div>

      <div className="grid grid-cols-7 rule-hair">
        {rows.map((row, i) => {
          const positive = row.delta > 0;
          return (
            <div
              key={row.label}
              className={clsx(
                'flex flex-col items-center justify-center py-2.5 border-t-2',
                i > 0 && 'border-l border-border-subtle',
                row.isActual ? 'border-t-accent bg-bg-elevated' : 'border-t-transparent'
              )}
              aria-current={row.isActual ? 'true' : undefined}
            >
              <span className="font-mono text-[10px] tabular text-text-tertiary">{row.label}</span>
              <span
                className={clsx(
                  'font-display font-bold text-sm tabular mt-0.5',
                  row.isActual ? 'text-text-primary' : positive ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {positive ? '+' : ''}
                {row.delta}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
