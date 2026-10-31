'use client';
import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-segment error boundary. Rendered inside the root layout, so the
 * theme/fonts/nav are still present. Tiles spell ERROR in the absent colour.
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
    <div className="flex items-center justify-center min-h-[calc(100dvh-52px)] px-4 bg-bg-base">
      <div className="flex flex-col items-center text-center max-w-md">
        <div className="flex gap-1.5" role="img" aria-label="ERROR">
          {WORD.split('').map((ch, i) => (
            <span
              key={i}
              className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-tile text-white font-display font-black text-2xl sm:text-3xl select-none"
              style={{
                backgroundColor: 'var(--tile-absent)',
                animation: `pop-in 260ms ease ${i * 70}ms both`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>

        <h1 className="mt-8 font-display font-black tracking-tight text-3xl text-text-primary">
          Something went wrong
        </h1>
        <p className="mt-2 text-base font-sans text-text-secondary">
          That guess didn&apos;t land. You can try again, or head back home.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono tabular-nums text-xs text-text-tertiary">ref {error.digest}</p>
        )}

        <div className="mt-8 flex flex-row gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-8 py-3 rounded-md border-2 border-border-default hover:border-border-strong text-text-primary font-bold uppercase tracking-wider text-sm transition-colors"
          >
            Go home
          </Link>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-tile-correct text-white font-bold uppercase tracking-wider text-sm hover:brightness-110 transition-[filter]"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
