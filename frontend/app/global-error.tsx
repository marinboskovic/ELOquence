'use client';
import './globals.css';

/**
 * Last-resort error boundary: replaces the root layout entirely, so it must
 * render its own <html>/<body>. Fonts from next/font aren't available here;
 * the CSS tokens still are (globals.css is imported).
 */
const WORD = 'ERROR';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-[100dvh] text-text-primary antialiased bg-bg-base">
        <div className="flex items-center justify-center min-h-[100dvh] px-4">
          <div className="flex flex-col items-center text-center max-w-md">
            <div className="flex gap-1.5" role="img" aria-label="ERROR">
              {WORD.split('').map((ch, i) => (
                <span
                  key={i}
                  className="flex items-center justify-center w-14 h-14 rounded-tile text-white font-black text-2xl select-none"
                  style={{ backgroundColor: 'var(--tile-absent)' }}
                >
                  {ch}
                </span>
              ))}
            </div>
            <h1 className="mt-8 font-black tracking-tight text-3xl text-text-primary">Something went wrong</h1>
            <p className="mt-2 text-base text-text-secondary">
              ELOquence hit an unexpected error. Try again, or reload the page.
            </p>
            {error.digest && (
              <p className="mt-1 font-mono tabular-nums text-xs text-text-tertiary">ref {error.digest}</p>
            )}
            <div className="mt-8 flex flex-row gap-3">
              <a
                href="/"
                className="inline-flex items-center justify-center px-8 py-3 rounded-md border-2 border-border-default text-text-primary font-bold uppercase tracking-wider text-sm"
              >
                Go home
              </a>
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center justify-center px-8 py-3 rounded-md bg-tile-correct text-white font-bold uppercase tracking-wider text-sm"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
