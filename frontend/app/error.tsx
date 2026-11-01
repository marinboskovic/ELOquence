'use client';
import { useEffect } from 'react';
import Tile from '@/components/Tile';
import { Button, ButtonLink, Label } from '@/components/ui';

/**
 * Route-segment error boundary. Rendered inside the root layout, so the
 * theme/fonts/nav are still present. An ink block states the problem;
 * the tiles spell ERROR in the absent colour (a guess that didn't land).
 */
const WORD = 'ERROR';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface in the console for debugging; the UI stays generic.
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-page flex items-center bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-end">
          <section className="md:col-span-8 bg-bg-ink text-text-on-ink p-6 md:p-12 flex flex-col gap-8">
            <Label className="text-text-on-ink opacity-70">something went wrong</Label>
            <div className="flex" style={{ gap: 'var(--tile-gap)' }} role="img" aria-label={WORD}>
              {WORD.split('').map((ch, i) => (
                <Tile
                  key={i}
                  letter={ch}
                  state="absent"
                  position={i}
                  isFlipping
                  flipDelay={i * 0.08}
                  size="clamp(44px, 6vw, 64px)"
                />
              ))}
            </div>
            <h1 className="font-display text-display-lg text-balance">Something went wrong on our side.</h1>
            <p className="text-base max-w-md opacity-80">Nothing you did. Your games are safe.</p>
            {error.digest && <Label className="text-text-on-ink opacity-50">ref {error.digest}</Label>}
          </section>

          <div className="md:col-span-4 flex flex-col gap-3 md:items-start">
            <ButtonLink href="/play" size="lg">
              Back to Play
            </ButtonLink>
            <Button variant="ghost" size="sm" onClick={() => reset()} className="self-start">
              or try this page again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
