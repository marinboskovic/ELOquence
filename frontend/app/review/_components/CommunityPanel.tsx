'use client';
/**
 * Detailed view, final step: how other players did with this word.
 */
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { SectionHead, Stat } from '@/components/ui';
import { communityApi } from '@/lib/api';
import { fmtInt } from '@/lib/copy';

interface WordStats {
  word: string;
  times_played: number;
  times_solved: number;
  solve_rate: number;
  avg_guesses: number | null;
  avg_accuracy: number | null;
  difficulty: number | null;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton bg-bg-muted', className)} />;
}

export default function CommunityPanel({
  gameId,
  targetWord,
  playerGuesses,
}: {
  gameId: string;
  targetWord: string | null;
  playerGuesses: number;
}) {
  const [stats, setStats] = useState<WordStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    communityApi
      .gameStats(gameId)
      .then((res: { data: WordStats }) => setStats(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) {
    return (
      <section className="rule-top pt-6 mt-10">
        <Skeleton className="h-6 w-48 mb-3" />
        <Skeleton className="h-24" />
      </section>
    );
  }

  if (!stats) return null;

  const hasData = stats.times_played > 0;
  const delta = hasData && stats.avg_guesses != null ? playerGuesses - stats.avg_guesses : null;
  const beatAvg = delta != null && delta < 0;
  const word = targetWord ? targetWord.toUpperCase() : 'this word';

  return (
    <section className="mt-6">
      <SectionHead eyebrow="other players" title={<>How others did with {word}</>} />
      <p className="font-sans text-sm leading-relaxed text-text-secondary mt-3 mb-6">
        {hasData
          ? `${fmtInt(stats.times_played)} other ELOquence players have faced this word.`
          : 'No one else has played this word yet — numbers will appear as others solve it.'}
      </p>

      {hasData && (
        <div className="grid grid-cols-2 gap-x-6 mb-4 max-w-md">
          <Stat label="solved it" value={`${Math.round(stats.solve_rate)}%`} sub="share of players who found the word" />
          <Stat
            label="average guesses"
            value={stats.avg_guesses != null ? stats.avg_guesses.toFixed(1) : '—'}
            sub={
              delta != null ? (
                <span className={clsx('font-mono tabular', beatAvg ? 'text-text-primary font-semibold' : 'text-text-tertiary')}>
                  you: {playerGuesses} ({delta > 0 ? '+' : ''}
                  {delta.toFixed(1)} vs average)
                </span>
              ) : undefined
            }
          />
        </div>
      )}

      {hasData && <p className="font-sans text-xs text-text-tertiary">As more players solve this word, these numbers get more reliable.</p>}
    </section>
  );
}
