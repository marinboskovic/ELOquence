# Beginner overhaul — shared brief for every page agent

## Why
The app (ELOquence: competitive Wordle with ratings and post-game analysis, a FER bachelor's thesis) was
presented to a committee. Verdict: "unintuitive, full of things that would confuse and scare an average
user; built for hardcore players, not for beginners or people who want to learn." The owner likes the
current visual look ("Atelier", see `DESIGN.md`) — keep it. Change what things are called, what is shown
by default, and how it is explained.

## The mechanism (already built — use it, do not reinvent)
- `lib/copy.ts` — the vocabulary. `MODES` (Daily / Ranked / Practice / Friends), `TERMS` (rating,
  skill, luck, information→"Narrowing", wordsLeft, opener→"First word", wordRating, hardMode, streak,
  accuracy, season, placement→"First 5 games"), `MOVE_CLASS` (Brilliant / Best / Good / Fine /
  Slightly off / Costly / Big miss / Missed win / Only option, each with a one-line `simple`),
  helpers `narrowing()`, `ratingDelta()`, `resultSentence()`. **Every label on screen must come from
  here or be plain English.** Add to copy.ts if a term is missing (append; do not rename existing keys).
- `lib/viewMode.tsx` — `useViewMode()` → `{ mode, detailed, setMode, toggle }`. Default is **simple**.
- `components/ui`:
  - `<Hint term="skill">` — renders the term's name with a dotted underline; hover/focus/tap shows the
    plain explanation (simple or detailed text depending on view). `<Hint title="…" body="…">Label</Hint>`
    for ad-hoc ones. Use it on every stat label a beginner could not guess.
  - `<Detail>…</Detail>` — children only in Detailed view; `<Detail simple={<…/>}>` shows a fallback.
  - `<DetailToggle />` — Simple | Detailed switch. Put one in the header area of any page that has a
    detailed layer (review, profile, lab).
  - Existing kit: Button, ButtonLink, Label, Tag (tones neutral/green/ochre/accent/ink/on-ink),
    SectionHead, Stat, CountUp, Reveal, SplitWords, MiniTiles, PatternRow.

## Rules for Simple view (the default)
1. **Words before numbers.** "Cut 2,309 words to 78" instead of "4.9 bits". "Solved in 4" instead of
   "4/6". "Rating +12" instead of "±ELO". Never show "bits", "entropy", "ELO", "percentile", "placement"
   in Simple view. ("Rating" is fine; "First 5 games" instead of placement.)
2. **One idea per block.** A beginner should be able to say what each section is for from its title.
   Rename sections in plain language ("Words that beat you" is good; "Pace · Habits" is not → "How you
   play"; "Distribution" → "How many guesses you need"; "Nemesis" → drop the word).
3. **Every number has a sentence.** Skill 92 → "92 · your guesses were close to the best choice".
4. **Progressive disclosure.** The full stats are not deleted — they move behind `<Detail>` or
   "Show the numbers". Detailed view should still look designed, not like a debug dump.
5. **Tell the user what to do next.** Every empty state and every end state has one clear action
   (the Button primary). Avoid two primaries.
6. **No jargon in nav or titles.** "Lab" → "Word Lab" (title: "Try a first word"). "Archive" →
   "Past dailies". "FAQ" → "Help". "Competitive" → "Ranked". "Challenge" → "Friends".
7. Keep **Detailed** view for the thesis: all the current metrics stay available there, with `<Hint>`s.

## Hard constraints
- Keep the visual language: tokens from `globals.css` / Tailwind only, no new hex colours, radius 0,
  rules not cards, mono uppercase micro-labels, Schibsted display. Motion as in DESIGN.md §5.
- `npx tsc --noEmit` must pass when you finish. Do not run `pnpm build` (the orchestrator builds).
- Do not commit. Do not touch files outside the list in your task. Do not edit `lib/copy.ts` keys
  that exist (appending new ones is fine), `lib/viewMode.tsx`, `components/ui/index.tsx` (ask if a
  primitive is missing — otherwise add a local component in your own file), `components/Navigation.tsx`.
- Backend/API is unchanged. Field names in `lib/types.ts` / `lib/api.ts` stay; only presentation changes.
- Accessibility rules from the last audit stay: ≥ 4.5:1 text contrast (use the tokens), ≥ 24 px
  targets, one h1 per page, `aria-current` on active tabs.
- Mobile: a 56 px bottom tab bar now exists on < md (`--tabbar-h`); `.min-h-page` already accounts
  for it. Don't add your own bottom-fixed elements on mobile.

## Nav (already rebuilt): Play · Improve (Learn, Word Lab, Help) · Ranked (Leaderboard, This season) ·
you-menu (Your profile, Past dailies, Achievements, Settings, Simple/Detailed, Sign out).
Mobile tab bar: Play · Learn · Lab · Ranked · You.
`/dashboard` and `/u/[username]` are being merged into one profile page (`/u/[username]`); when it is
your own profile it shows private extras. Link to `/u/<username>` for "your stats"; `/dashboard` will
redirect.

When done, reply with: files changed, what a beginner now sees on each screen (3–6 bullets), anything
you could not do.
