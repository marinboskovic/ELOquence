'use client';
import { ButtonLink, Label, Reveal } from '@/components/ui';
import GuessDistribution from '@/components/GuessDistribution';

/**
 * "How many guesses you need" — the guess distribution, explained in a
 * sentence. Uses the profile's all-time distribution for everyone.
 */
export default function GuessesSection({
  distribution,
  completed,
  wins,
  isOwner,
}: {
  distribution: Record<string, number>;
  completed: number;
  wins: number;
  isOwner: boolean;
}) {
  const losses = Math.max(0, completed - wins);
  return (
    <Reveal as="section" aria-label="How many guesses you need" className="grid grid-cols-1 md:grid-cols-12 gap-8">
      <div className="md:col-span-4 rule-top pt-3">
        <Label className="block mb-1">guesses</Label>
        <h2 className="font-display text-display-md text-text-primary">How many guesses {isOwner ? 'you need' : 'they need'}</h2>
        <p className="text-sm text-text-secondary mt-3 max-w-xs">
          Each bar counts the games solved in that many guesses. The X row is games where the word got away.
        </p>
      </div>
      <div className="md:col-span-8 md:pt-3">
        {completed > 0 ? (
          <GuessDistribution distribution={distribution} losses={losses} />
        ) : isOwner ? (
          <div className="rule-hair pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-sm text-text-secondary">Finish a game and the bars will start to fill.</p>
            <ButtonLink href="/play" variant="secondary" size="sm" className="shrink-0">
              play a game
            </ButtonLink>
          </div>
        ) : (
          <p className="rule-hair pt-4 text-sm text-text-secondary">No finished games yet.</p>
        )}
      </div>
    </Reveal>
  );
}
