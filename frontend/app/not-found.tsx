import Tile from '@/components/Tile';
import { ButtonLink, Label } from '@/components/ui';
import type { TileState } from '@/lib/types';

/**
 * 404 in the Wordle vocabulary: a guessed row that isn't in the word list.
 * Server component — Tile and the UI kit are client components, which is
 * fine to compose from here.
 */
const WORD = 'EMPTY';
// Mostly absent with a couple of "present" hints — reads as a failed guess.
const STATES: TileState[] = ['absent', 'present', 'absent', 'absent', 'present'];

export default function NotFound() {
  return (
    <div className="min-h-page flex items-center bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 w-full">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-end">
          <section className="md:col-span-8 bg-bg-ink text-text-on-ink p-6 md:p-12 flex flex-col gap-8">
            <Label className="text-text-on-ink opacity-70">404 · page not found</Label>
            <div className="flex" style={{ gap: 'var(--tile-gap)' }} role="img" aria-label="EMPTY — page not found">
              {WORD.split('').map((ch, i) => (
                <Tile
                  key={i}
                  letter={ch}
                  state={STATES[i]}
                  position={i}
                  isFlipping
                  flipDelay={i * 0.08}
                  size="clamp(44px, 6vw, 64px)"
                />
              ))}
            </div>
            <h1 className="font-display text-display-lg text-balance">That page doesn&apos;t exist.</h1>
            <p className="text-base max-w-md opacity-80">
              Like a word that isn&apos;t in the list. The link may be old or mistyped.
            </p>
          </section>

          <div className="md:col-span-4 flex flex-col gap-3">
            <ButtonLink href="/play" size="lg">
              Back to Play
            </ButtonLink>
          </div>
        </div>
      </div>
    </div>
  );
}
