import Link from 'next/link';

/**
 * 404 in the Wordle vocabulary: a guessed row that isn't in the word list.
 * Server component — no hooks, no client JS needed.
 */
const WORD = 'EMPTY';
// Mostly absent with a couple of "present" hints — reads as a failed guess.
const STATES: Array<'present' | 'absent'> = ['absent', 'present', 'absent', 'absent', 'present'];

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100dvh-52px)] px-4 bg-bg-base">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex gap-1.5" style={{ perspective: 900 }} role="img" aria-label="EMPTY — not in word list">
          {WORD.split('').map((ch, i) => (
            <span
              key={i}
              className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-tile text-white font-display font-black text-2xl sm:text-3xl select-none"
              style={{
                backgroundColor: `var(--tile-${STATES[i]})`,
                animation: `pop-in 260ms ease ${i * 70}ms both`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        <h1 className="mt-8 font-display font-black tracking-tight text-3xl text-text-primary">
          Not in word list
        </h1>
        <p className="mt-2 text-base font-sans text-text-secondary">
          This page isn&apos;t in the word list. It may have moved, or the link was mistyped.
        </p>
        <p className="mt-1 font-mono tabular-nums text-xs text-text-tertiary">404</p>

        <div className="mt-8 flex flex-row gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3 rounded-md border-2 border-border-default hover:border-border-strong text-text-primary font-bold uppercase tracking-wider text-sm transition-colors"
          >
            Home
          </Link>
          <Link
            href="/play"
            className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-tile-correct text-white font-bold uppercase tracking-wider text-sm hover:brightness-110 transition-[filter]"
          >
            Play
          </Link>
        </div>
      </div>
    </div>
  );
}
