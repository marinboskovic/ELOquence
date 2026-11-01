# ELOquence — Design Language "Atelier"

**Theme statement:** `calm, editorial, paper` — a printed chess magazine that happens to be a game.
**Dials:** Creativity = Bold · Density = Balanced · Variance = Balanced · **Motion = Kinetic**.
**Non-negotiables:** light + dark parity; colour-blind palette keeps working; WCAG AA text contrast;
`prefers-reduced-motion` and the in-app Reduced Motion setting disable all non-essential motion.

Precedence: this file → `app/globals.css` tokens → `tailwind.config.ts`. Never hard-code hex in components.

---

## 1. Colour

| Role | Light | Dark | Token |
|---|---|---|---|
| Paper (page) | `#f3f3f1` | `#121211` | `bg-bg-base` / `--bg-base` |
| Sheet (card/surface) | `#fbfbfa` | `#191918` | `bg-bg-elevated` |
| Recessed | `#e9e9e5` | `#222220` | `bg-bg-muted` |
| Ink block (inverted) | `#121212` | `#f1f1ec` | `bg-bg-ink` + `text-text-on-ink` |
| Ink (text) | `#121212` | `#f1f1ec` | `text-text-primary` |
| Secondary / tertiary | `#5c5c57 / #6a6a64` | `#a6a69f / #8a8a83` | `text-text-secondary / -tertiary` (both ≥ 4.5:1 on paper) |
| Ghost (decoration only, never text) | `#c3c3bd` | `#40403c` | `--text-ghost` — scrollbars, hairlines, placeholders are **not** allowed |
| Rule, hair | `#dadad4` | `#2b2b28` | `border-border-subtle` |
| Rule, ink | `#121212` | `#f1f1ec` | `border-border-default` |
| **Accent (Wordle green)** | `#1f7a4d` (white ink) | `#2e9a63` (**ink text** — white fails AA on it) | `bg-accent text-accent-ink`, `--accent` |
| Accent wash | `#e3efe7` | `#172a1f` | `bg-accent-soft` |
| Tile correct / present / absent | `#1f7a4d / #c78c1c / #c9c9c3` | `#2e9a63 / #d9a033 / #3a3a37` | `var(--tile-*)` |
| Washes (section tints) | green `#e3efe7`, ochre `#f3ead3`, accent `#fbe4dc` | `#172a1f / #2b2416 / #33201a` | `bg-wash-green / -ochre / -accent` |

Rules:
- **One accent per surface.** The green is for the primary action, the live/active indicator and the
  current nav item. Never for body text, never for decoration. Tile colours are *semantic*, they are
  not accents.
- **Washes add warmth.** A section or card may sit on a wash (green for wins/positive, ochre for
  streaks/warnings/placement, accent for danger-adjacent or "new"). Max one wash per viewport band.
- **Ink blocks** (inverted black panels with chalk text) are the editorial drama device: hero
  statements, game-over, big numbers. Use sparingly; one per page.
- **Targets:** every link or control accepts at least a 24×24 hit (WCAG 2.5.8); `.ink-link` gets it from an invisible ±6px pseudo-element, nav items from `py-2`.
- Absent tiles carry `color: var(--tile-absent-text)`; correct/present tiles use white text.

## 2. Typography

| Role | Face | Weight | Tracking |
|---|---|---|---|
| Display (h1/h2, tile letters, hero numbers) | **Schibsted Grotesk** `font-display` | 700–900 | −0.035 … −0.045em |
| Body & UI | **IBM Plex Sans** `font-sans` | 400–600 | 0 |
| Data, stats, micro-labels | **JetBrains Mono** `font-mono` | 400–600 | labels +0.14em, uppercase |

Scale (Tailwind): `text-display-xl` (hero, 56–128px) · `text-display-lg` (page title) ·
`text-display-md` (section) · `text-display-sm` (card title) · `text-label` (11px mono uppercase).
Body 16/1.55 (`text-base`), small 14 (`text-sm`), captions 12 (`text-xs`).
Big numbers always `font-display font-black tabular`. Headlines wrap with `text-wrap: balance`.

## 3. Shape, space, depth

- **Radius 0** everywhere (Tailwind radii are all collapsed to 0). `rounded-full` only for avatars,
  dots and the "live" indicator.
- **Rules instead of cards.** Separate with `rule-top` (2px ink) and `rule-hair` (1px subtle).
  A bordered card (`border border-border-default`) is allowed when it is an *object* (a game, a
  session, a result row) — not as the default container.
- **Depth:** none. The only shadow is the hard print offset `shadow-ink` (4px 4px ink) for the
  one element that must float (dialog, dragged item, primary CTA on hover).
- **Spacing:** 8px grid; section stack 64/96px, group gap 24px, inline 8/12px. Page container
  `max-w-6xl px-4 md:px-8`. Dense tables use 4px multiples.
- **Grid:** 12 columns on desktop; editorial asymmetry is encouraged (7/5, 8/4 splits), never three
  identical cards in a row.

## 4. Components (primitives in `components/`)

- **Tile** — 2px ink border, square. States: empty (ghost border), tbd (ink border + pop), revealed
  (ink-fill animation `.tile-ink`, colour pours up from the bottom in `--dur-slow` with `--ease-ink`,
  letter flips to white at 55%). No 3D flip.
- **Keyboard** — outlined keys (1.5px ink), fill on state; press = instant ink invert (`--key-pressed-bg`).
- **Button** — primary: `bg-accent text-accent-ink`, uppercase mono label, hover gains `shadow-ink`
  and translates −2px/−2px (the "lift"). Secondary: 2px ink outline. Tertiary: `ink-link`.
- **Nav** — hairline bottom rule, wordmark in display 900, items are `ink-link`s, current item
  underlined in accent.
- **Dialog** — paper sheet with 2px ink border + `shadow-ink`, backdrop is tinted paper at 72%.
- **Toast** — ink block, chalk text, slides down.
- **Stat** — label (mono uppercase) over display number; a 1px rule above.
- **Pill/Tag** — rectangular, mono uppercase 11px, 1px border; wash background for semantic state.

## 5. Motion grammar (Kinetic)

| Moment | Treatment | Duration / easing |
|---|---|---|
| Tile reveal | ink-fill from bottom, 80ms stagger per tile | 480ms `--ease-ink` |
| Typing | pop 0.88→1 | 140ms spring |
| Invalid word | row shake (x: 0,−8,8,−6,6,−3,3,0) + toast | 450ms |
| Win | row bounce + ink block game-over sheet slides up | 600ms / 420ms `--ease-out` |
| Page enter | content rises 12px + fades, headline letters stagger (display only) | 420ms `--ease-out`, 30ms/letter |
| Hover (links) | underline wipes left→right | 260ms `--ease-ink` |
| Hover (buttons/cards) | lift −2px with hard shadow | 140ms |
| Numbers | count-up on first view (stats, ELO) | 800ms `--ease-out` |
| Lists | stagger children 40ms | 260ms |
| Ambient | landing hero: slow marquee of today's words / a giant letter grid that fills one tile at a time | continuous, pauses on hover |

Everything above is off under `prefers-reduced-motion` / `.reduce-motion` (CSS kills durations;
framer-motion runs through `MotionConfig reducedMotion`).

## 6. Voice

Short, declarative, lower-case micro-labels in mono (`rating`, `streak`, `bits`). No exclamation
marks except on a win. Numbers carry units (`5.74 bits`, `+31`). Croatian product name stays
"ELOquence" in the wordmark.

## 7. Don'ts

Gradients, glows, blur, glassmorphism, rounded corners, soft shadows, emoji as icons, centred body
text, three equal cards in a row, accent used for more than one thing on a screen.
