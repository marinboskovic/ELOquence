'use client';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import type { PublicProfile } from '@/lib/api';
import { MODES, ratingDelta, resultSentence } from '@/lib/copy';
import type { GameMode } from '@/lib/types';
import { Hint, Label, PatternRow, Reveal, staggerChild, staggerParent } from '@/components/ui';

type PublicGame = PublicProfile['recent_games'][number];

function modeName(mode: string): string {
  return MODES[mode as GameMode]?.short ?? mode;
}

function GameCard({ game }: { game: PublicGame }) {
  const won = game.status === 'won';
  const status = (['won', 'lost', 'in_progress', 'abandoned'] as const).includes(game.status as never)
    ? (game.status as 'won' | 'lost' | 'in_progress' | 'abandoned')
    : 'abandoned';
  const result = resultSentence(status, game.num_guesses);
  const delta = ratingDelta(game.elo_delta);
  return (
    <motion.div
      variants={staggerChild}
      className="shrink-0 w-[124px] border-2 border-border-default bg-bg-base p-2.5 flex flex-col gap-2 min-w-0 transition-all duration-fast hover:shadow-ink hover:-translate-x-0.5 hover:-translate-y-0.5"
      title={`${modeName(game.mode)}${game.hard_mode ? ' · hard mode' : ''} · ${result}`}
    >
      <div className="flex flex-col justify-end" style={{ gap: 2, minHeight: 6 * 12 }}>
        {game.patterns.map((p, i) => (
          <PatternRow key={i} pattern={p} size={10} gap={2} />
        ))}
      </div>
      <span className={clsx('font-display font-bold text-sm tabular leading-tight', won ? 'text-text-primary' : 'text-text-secondary')}>
        {result}
        {game.hard_mode && <span className="text-text-tertiary">*</span>}
      </span>
      <span className="flex items-baseline justify-between gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-text-tertiary">
        <span className="truncate">{modeName(game.mode)}</span>
        <span className={clsx('tabular normal-case tracking-normal', delta !== '—' && game.elo_delta! > 0 ? 'text-accent' : '')}>{delta}</span>
      </span>
    </motion.div>
  );
}

/** Public recent games — the compact pattern cards visitors see. */
export default function RecentGamesStrip({ games, username }: { games: PublicGame[]; username: string }) {
  return (
    <Reveal as="section" aria-label="Recent games">
      <div className="rule-top pt-3 flex items-end justify-between gap-4">
        <div>
          <Label className="block mb-1">recent</Label>
          <h2 className="font-display text-display-md text-text-primary">Recent games</h2>
        </div>
        {games.some((g) => g.hard_mode) && (
          <Label>
            <Hint term="hardMode">* hard mode</Hint>
          </Label>
        )}
      </div>
      {games.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">{username} has not played yet.</p>
      ) : (
        <div className="mt-5 -mx-4 px-4 md:-mx-8 md:px-8 overflow-x-auto hide-native-scrollbar">
          <motion.div className="flex gap-3 pb-2 pr-2 w-max" variants={staggerParent} initial="hidden" animate="show">
            {games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </motion.div>
        </div>
      )}
    </Reveal>
  );
}
