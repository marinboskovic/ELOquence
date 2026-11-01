'use client';
import type { PublicProfile } from '@/lib/api';
import { Detail, Hint, SectionHead } from '@/components/ui';
import { useViewMode } from '@/lib/viewMode';
import HintStat from '@/components/dashboard/HintStat';
import clsx from 'clsx';

/**
 * Four numbers with a sentence each. Detailed view adds peak rating and
 * accuracy, the two that need a definition.
 */
export default function AtAGlance({ profile }: { profile: PublicProfile }) {
  const { detailed } = useViewMode();
  const solvedPct = profile.completed > 0 ? Math.round((profile.wins / profile.completed) * 100) : null;
  const avg = profile.avg_guesses;

  return (
    <section aria-label="At a glance" className="flex flex-col gap-6">
      <SectionHead
        eyebrow="all games"
        title="At a glance"
        aside={profile.rated_games > 0 ? `${profile.rated_games} ranked game${profile.rated_games === 1 ? '' : 's'}` : undefined}
      />
      <div className={clsx('grid grid-cols-2 gap-x-6 gap-y-6', detailed ? 'md:grid-cols-6' : 'md:grid-cols-4')}>
        <HintStat label="games" value={profile.completed} sub={profile.completed === 0 ? 'none finished yet' : 'finished so far'} />
        <HintStat
          label="solved"
          value={profile.wins}
          sub={solvedPct != null ? `${solvedPct}% of games solved` : 'no games yet'}
        />
        <HintStat
          label="usual guesses"
          value={avg != null ? avg.toFixed(1) : '—'}
          sub={avg != null ? 'on average, when you solve it' : 'solve a game to find out'}
        />
        <HintStat
          label={<Hint term="streak">best streak</Hint>}
          value={profile.max_streak}
          sub={profile.current_streak > 0 ? `${profile.current_streak} right now` : 'days in a row on the Daily'}
        />
        <Detail>
          <HintStat
            label={<Hint title="Peak rating" body="The highest your rating has ever been.">peak</Hint>}
            value={Math.round(profile.peak_elo)}
            sub="highest rating so far"
          />
          <HintStat
            label={<Hint term="accuracy">accuracy</Hint>}
            value={profile.avg_accuracy != null ? `${Math.round(profile.avg_accuracy)}%` : '—'}
            sub={profile.best_accuracy != null ? `best game ${Math.round(profile.best_accuracy)}%` : 'review a game to get one'}
          />
        </Detail>
      </div>
    </section>
  );
}
