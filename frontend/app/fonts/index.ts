/**
 * Self-hosted variable fonts (woff2 files vendored next to this file; they
 * come from the @fontsource-variable packages, OFL licensed — see the
 * LICENSE-*.txt files). Previously these came from Google Fonts through
 * `next/font/google`, which made every production build depend on
 * fonts.googleapis.com being reachable at build time and leaked a request
 * fingerprint to Google on each cold build. `next/font/local` gives the same
 * preloading, `size-adjust` fallbacks and zero layout shift.
 */
import localFont from 'next/font/local';

export const libreFranklin = localFont({
  src: [
    { path: './libre-franklin-latin-wght-normal.woff2', style: 'normal' },
    { path: './libre-franklin-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '100 900',
  variable: '--font-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const robotoSlab = localFont({
  src: [{ path: './roboto-slab-latin-wght-normal.woff2', style: 'normal' }],
  weight: '100 900',
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const jetbrainsMono = localFont({
  src: [{ path: './jetbrains-mono-latin-wght-normal.woff2', style: 'normal' }],
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
  fallback: ['JetBrains Mono', 'monospace'],
});
