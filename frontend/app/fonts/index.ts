/**
 * Self-hosted variable fonts (via @fontsource-variable, bundled from
 * node_modules). Previously these came from Google Fonts through
 * `next/font/google`, which made every production build depend on
 * fonts.googleapis.com being reachable at build time and leaked a request
 * fingerprint to Google on each cold build. `next/font/local` gives the same
 * preloading, `size-adjust` fallbacks and zero layout shift.
 */
import localFont from 'next/font/local';

export const libreFranklin = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-normal.woff2', style: 'normal' },
    { path: '../../node_modules/@fontsource-variable/libre-franklin/files/libre-franklin-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '100 900',
  variable: '--font-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const robotoSlab = localFont({
  src: [{ path: '../../node_modules/@fontsource-variable/roboto-slab/files/roboto-slab-latin-wght-normal.woff2', style: 'normal' }],
  weight: '100 900',
  variable: '--font-display',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

export const jetbrainsMono = localFont({
  src: [{ path: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', style: 'normal' }],
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
  fallback: ['JetBrains Mono', 'monospace'],
});
