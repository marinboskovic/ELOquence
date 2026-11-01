import type { Config } from 'tailwindcss'

/**
 * Atelier design tokens (see DESIGN.md). Everything maps to the CSS custom
 * properties in app/globals.css so light/dark/colour-blind switch at runtime.
 *
 * Radii are deliberately collapsed to 0 (Swiss grid, hard edges). Only
 * `rounded-full` survives, for avatars and dots.
 */
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    borderRadius: {
      none: '0',
      sm: '0',
      DEFAULT: '0',
      md: '0',
      lg: '0',
      xl: '0',
      '2xl': '0',
      '3xl': '0',
      card: '0',
      'card-lg': '0',
      tile: '0',
      key: '0',
      pill: '0',
      full: '9999px',
    },
    boxShadow: {
      none: 'none',
      card: 'none',
      'card-hover': 'none',
      elevated: 'none',
      modal: 'none',
      // Hard offset "print" shadow — the one depth device this style allows.
      ink: '4px 4px 0 0 var(--border-default)',
      'ink-sm': '2px 2px 0 0 var(--border-default)',
    },
    extend: {
      colors: {
        bg: {
          base:     'var(--bg-base)',
          elevated: 'var(--bg-elevated)',
          muted:    'var(--bg-muted)',
          ink:      'var(--bg-ink)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary:  'var(--text-tertiary)',
          ghost:     'var(--text-ghost)',
          'on-ink':  'var(--text-on-ink)',
        },
        tile: {
          correct: 'var(--tile-correct)',
          present: 'var(--tile-present)',
          absent:  'var(--tile-absent)',
          empty:   'var(--tile-empty-bg)',
        },
        border: {
          subtle:  'var(--border-subtle)',
          default: 'var(--border-default)',
          strong:  'var(--border-strong)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          ink:     'var(--accent-ink)',
          soft:    'var(--accent-soft)',
        },
        wash: {
          green:  'var(--wash-green)',
          ochre:  'var(--wash-ochre)',
          accent: 'var(--wash-accent)',
          ink:    'var(--wash-ink)',
        },
        tier: {
          novice:      '#8a8a84',
          veteran:     '#c78c1c',
          master:      '#1f7a4d',
          grandmaster: '#2f5d8f',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        sans:    ['var(--font-sans)', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono:    ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Editorial display scale (ratio ≈ 1.25, base 16)
        'display-xl': ['clamp(3.5rem, 9vw, 8rem)', { lineHeight: '0.92', letterSpacing: '-0.045em', fontWeight: '900' }],
        'display-lg': ['clamp(2.5rem, 6vw, 4.5rem)', { lineHeight: '0.95', letterSpacing: '-0.04em', fontWeight: '900' }],
        'display-md': ['clamp(1.75rem, 3.5vw, 2.5rem)', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '800' }],
        'display-sm': ['1.375rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        label: ['0.6875rem', { lineHeight: '1.2', letterSpacing: '0.14em', fontWeight: '600' }],
      },
      transitionTimingFunction: {
        ink: 'cubic-bezier(0.7, 0, 0.2, 1)',
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      transitionDuration: {
        fast: '140ms',
        med:  '260ms',
        slow: '480ms',
      },
      animation: {
        shimmer: 'shimmer 2s ease-in-out infinite',
        marquee: 'marquee 28s linear infinite',
      },
      borderWidth: {
        rule: '1px',
        'rule-strong': '2px',
      },
    },
  },
  plugins: [],
}
export default config
