/**
 * Self-hosted variable fonts (woff2 vendored next to this file; OFL — see the
 * LICENSE-*.txt files). No Google Fonts request at build or run time.
 *
 * Roles (see DESIGN.md):
 *   --font-display  Schibsted Grotesk — headlines, tile letters, big numbers
 *   --font-sans     IBM Plex Sans     — body & UI
 *   --font-mono     JetBrains Mono    — data, stats, labels
 */
import localFont from 'next/font/local';

export const schibsted = localFont({
  src: [{ path: './schibsted-grotesk-latin-wght-normal.woff2', style: 'normal' }],
  weight: '400 900',
  variable: '--font-display',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const plexSans = localFont({
  src: [
    { path: './ibm-plex-sans-latin-wght-normal.woff2', style: 'normal' },
    { path: './ibm-plex-sans-latin-wght-italic.woff2', style: 'italic' },
  ],
  weight: '100 700',
  variable: '--font-sans',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const jetbrainsMono = localFont({
  src: [{ path: './jetbrains-mono-latin-wght-normal.woff2', style: 'normal' }],
  weight: '100 800',
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'SFMono-Regular', 'monospace'],
});
