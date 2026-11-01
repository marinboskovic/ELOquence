'use client';
import './globals.css';

/**
 * Last-resort error boundary: replaces the root layout entirely, so it must
 * render its own <html>/<body>. Fonts from next/font aren't available here
 * and we deliberately avoid any component import (if framer or the UI kit is
 * what broke, this must still paint). The CSS tokens still are available
 * because globals.css is imported, so the same ink-block statement is
 * hand-rolled with token-backed inline styles.
 */
const WORD = 'ERROR';

const BTN =
  'inline-flex items-center justify-center gap-2 h-14 px-7 text-sm font-mono font-semibold uppercase tracking-[0.14em] border-2 cursor-pointer';

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
        <div className="min-h-[100dvh] flex items-center">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 w-full">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-end">
              <section className="md:col-span-8 bg-bg-ink text-text-on-ink p-6 md:p-12 flex flex-col gap-8">
                <span className="font-mono text-label uppercase opacity-70">error · something went wrong</span>
                <div className="flex gap-2" role="img" aria-label={WORD}>
                  {WORD.split('').map((ch, i) => (
                    <span
                      key={i}
                      className="flex items-center justify-center w-12 h-12 md:w-16 md:h-16 font-black uppercase text-2xl md:text-3xl select-none"
                      style={{ backgroundColor: 'var(--tile-absent)', color: 'var(--tile-absent-text)' }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <h1 className="font-black text-display-lg" style={{ textWrap: 'balance' }}>
                  ELOquence hit an unexpected error.
                </h1>
                <p className="text-base max-w-md opacity-80">Try again, or reload the page.</p>
                {error.digest && (
                  <span className="font-mono text-label uppercase opacity-50">ref {error.digest}</span>
                )}
              </section>

              <div className="md:col-span-4 flex flex-col sm:flex-row md:flex-col gap-3">
                <button type="button" onClick={() => reset()} className={`${BTN} bg-accent text-accent-ink border-accent`}>
                  Try again
                </button>
                <a href="/" className={`${BTN} bg-transparent text-text-primary border-border-default`}>
                  Go home
                </a>
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
