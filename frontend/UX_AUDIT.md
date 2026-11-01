# ELOquence — UX/UI Audit (Atelier, branch `eloquence2.0`)

Scope · local production build (`next build`), test account with 1–3 games · viewports 1280×860 (light + dark) and 390×844 mobile · 2026-11-01 · 16 routes, 32 page snapshots: landing, lab, login, leaderboard, faq, play, dashboard, settings, profile, review, achievements, archive, learn (+ mobile landing/play/dashboard/lab/leaderboard/settings).

Method: the `ux-ui-audit` probe scripts (contrast, tap targets, focus ring, routes, heuristics, perception, LTR copy) evaluated in headless Chromium, then a reading pass over the full text of every page and a screenshot pass. Judged against `DESIGN.md` (house rules) and WCAG 2.2 AA. Numbers below are measured, not estimated. All findings marked **fixed** were corrected in the same commit and re-measured.

## Summary

Before: **235** text-contrast failures, **~100** controls under 24×24 px, no skip link, count-up numbers stuck at `0.00` after a fast scroll, one mobile horizontal overflow.
After: **0 / 0 / fixed / fixed / 0** across all 32 snapshots. 0 broken routes, 0 page errors, focus ring 4.79:1 on every control tested.

| Severity | Found | Fixed |
|---|---|---|
| Critical | 1 | 1 |
| Major | 3 | 3 |
| Accessibility | 6 | 6 |
| Note | 4 | 1 (3 left as design decisions, listed below) |

## Findings

**01 · Critical · /lab (and every CountUp / Reveal on the site)**
Numbers animated by `CountUp` stayed at `0` and `Reveal` sections stayed invisible if the user scrolled past them quickly — the IntersectionObserver never saw the element. The Lab's headline stats read as broken.
```
INFORMATION 0.00 bits  ·  RANK #0  ·  PERCENTILE top 0.0 %  ·  EXPECTED LEFT 0.0   (sub-labels said "98% of max", "#32 of 12,953")
```
FIX (done): new `useSeen()` hook in `components/ui` — true when in view *or* once the element has been scrolled past, with a 1.2 s safety net. `CountUp` and `Reveal` now use it.

**02 · Major · all pages, dark theme**
Primary buttons were white on the dark-theme green: `#ffffff` on `#2e9a63` = **3.55:1**, below 4.5:1 for 12 px bold labels (SC 1.4.3).
FIX (done): dark theme uses ink text on the accent (`--accent-ink: #121211`, 5.28:1). Light theme unchanged (white on `#1f7a4d`, 5.32:1). Documented in DESIGN.md.

**03 · Major · dashboard, achievements, profile, lab, archive — 11–12 px mono labels**
`--text-tertiary` (`#93938c`) on paper = **2.78:1**; dark `#73736d` = 3.93:1. 80 labels per theme failed ("400 TO VETERAN", "NO RATING HISTORY YET", "1 GAME", "PROGRESS", "MOST OFTEN · 2/6"). A further 49 used `--text-ghost` (`#c3c3bd`, **1.59:1**) as real text — archive day numbers, lab "· +260" counts, FAQ captions.
FIX (done): tertiary is now `#6a6a64` light (4.9:1) / `#8a8a83` dark (5.39:1); ghost is decoration-only (scrollbars) and every text use was moved to tertiary. DESIGN.md updated.

**04 · Major · mobile /dashboard**
The page scrolled sideways: `document.scrollWidth 410 > 390`. Cause: the `sr-only` "Delete" header cell is absolutely positioned and escaped the `overflow-x-auto` table wrapper (which had no positioning context).
FIX (done): wrapper is `relative`. Mode-filter rows on dashboard/achievements also gained a right-edge fade (`.scroll-fade-x`) so the clipped "CHALLENGE" tab is discoverable.

**05 · Accessibility · navigation, dashboard, settings, auth — SC 2.5.8 target size**
Nav items 22×28 px ("Lab"), ELO badge 87×19, "Sign in →" 55×20, ink-links 13 px tall ("PUBLIC PROFILE →", "OPEN IN LAB →", "PLAY NEW →"), settings index 22 px, settings toggles 40×22, review step dots 24×18.
FIX (done): `.ink-link` is now an inline-block with 6 px vertical padding pulled back by a negative margin (layout unchanged, 25 px+ hit box, underline still on the text); nav items `px-1`, badge/settings icons `py-2`/`p-2`, switch 44×24, review dots ≥ 24×24. Re-measured: 0 targets under 24 px.

**06 · Accessibility · all pages — SC 2.4.1 bypass blocks**
No skip link; keyboard users tab through 8–11 nav items on every page.
FIX (done): "Skip to content" as the first focusable, visible on focus, targets `<main id="main">`.

**07 · Accessibility · nav tier label, light + dark**
Tier colours were fixed hex values: NOVICE `#818384` on paper = 3.43:1 at 10 px; in dark the new light value measured 3.44:1.
FIX (done): `--tier-*` tokens per theme (light 4.9–6.1:1, dark 5.4–8:1); `RATING_TIERS.color` references them.

**08 · Accessibility · /lab ink block**
Tags inside the inverted panel rendered secondary ink on ink: `#5c5c57` on `#121212` = **2.79:1** ("5 UNIQUE", "2 VOWELS", "DIFFICULTY 610"); the `text-text-on-ink opacity-80` override lost to the Tag's own tone class.
FIX (done): new `Tag tone="on-ink"`.

**09 · Accessibility · /lab headline number**
"5.74" (40 px) in tile-ochre `#c78c1c` on paper = **2.63:1**, below 3:1 for large text.
FIX (done): `--text-present` / `--text-correct` tokens for coloured *text* (`#9a6a0f` 4.25:1 light, `#d9a033` 8:1 dark); tiles keep the original ochre.

**10 · Accessibility · settings danger buttons (mobile)**
"DELETE GAMES" `#d63b2f` on the coral wash = 3.81:1.
FIX (done): `--red` → `#b8291f` (5.11:1 on wash, 5.6:1 on paper).

**11 · Note · /u/[username]** — "1 games" (plural template). FIX (done).

**12 · Note · landing — duplicate destinations with different labels** (`/play`: "Play" / "PLAY TODAY'S WORD"; `/lab`: "Lab" / "OPEN THE LAB"). Left as is: nav label vs CTA is a deliberate convention and both labels name the same place.

**13 · Note · /leaderboard rank column** — top three unpadded display digits ("1 2 3"), the rest `04 05`. Left as is: editorial emphasis on the podium, intentional per DESIGN.md.

**14 · Note · /play heuristics** — Hick index 4.25 (18 interactive targets first screen; reference 3.2–4.0). Left as is: four mode cards + nav is the product's one decision; the primary ("Daily") is visually first.

## What works

- Focus indicator: `2px solid var(--accent)` with 2 px offset, **4.79:1** against paper on every control tested (SC 1.4.11 needs 3:1).
- Routes: 11 links on the landing surface, 6 followed, **0 broken**, 0 unnamed links, 0 missing accessible names, exactly one `h1` per page.
- Reduced motion: every animation (tile ink-fill, SplitWords, CountUp, Reveal, marquee) is disabled under `prefers-reduced-motion` and the in-app setting.
- Copy: no placeholder text anywhere; one product name throughout ("ELOquence", "Lab", "Coach"); plural templates correct after 11.
- Dark theme parity: identical layout, 0 contrast failures after fixes.

## Where to start (already done, for the record)

1. 01 count-up/reveal fallback — one hook, fixes a "broken numbers" impression on the showcase page.
2. 03 + 07 + 09 token changes — three hex values fixed 200+ failures.
3. 05 `.ink-link` hit box — one CSS rule fixed ~80 small targets.
4. 02 dark accent ink, 06 skip link, 04 mobile overflow.
