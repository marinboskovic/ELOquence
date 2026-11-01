# Learn — curriculum (v2)

Goal: teach someone the game and how to get good at it, in depth, with no filler. Stop when there is
nothing left to teach. Every lesson exists because a player who finishes it plays differently.

## Rules for every lesson
- 3–5 challenges. **No two consecutive challenges of the same kind.** At most **one** `reveal` per
  lesson, and never two reveals back to back anywhere. Reveals are for one fact that needs a picture,
  not for "takeaways" — the success notes already do that.
- Every challenge is a **real situation** (a named guess against a named target, or a real pool
  count) that the player could meet tonight. No abstract quizzes about "what is the win from…".
- Patterns shown in `multiple-choice` / `guess-next` options **must be the real Wordle pattern** for
  that guess/target (duplicate-letter rules included). Verify with a script; do not hand-type them.
- Numbers (words left, bits) must be plausible for the real 2,309-answer list. When in doubt say
  "about".
- Voice: plain words (see `lib/copy.ts`): "first word", "narrowing", "words left". "Bits" only in
  Module 7. No "extract info", no "probe" without explaining it the first time.
- Success notes: one sentence, says *why*, no exclamation marks except in the last lesson's finale.
- Lesson ids: `m{module}l{n}` fresh numbering (progress keys reset — acceptable).

## Modules

### M1 · How the game works — 2 lessons
Reading the board. For someone who has never played.
- **L1 Read the colours** — `tile-paint` CRANE vs ARISE (classic: yellows and greens) → `multiple-choice`
  "what does the yellow R tell you" (in the word / not in that spot / both) → `word-survivors` after
  CRANE's pattern, which of 8 words still fit (include traps that reuse R in the same spot).
- **L2 Twice the same letter** — `reveal` the duplicate rule with SPEED vs PRICE animated →
  `tile-paint` SPEED vs SHEEP (two E's) → `tile-tap` POPPY vs POSED: tap the P that is grey and why
  → `multiple-choice` ALLEY vs LEVEL-style: how many L's does the answer have, given the pattern.

### M2 · Your first word — 2 lessons
- **L1 What a good first word does** — `multiple-choice` SALET vs MAMMA against SOLAR (real
  patterns) → `letter-picker` build one (accept the top ~12 openers) → `pool-shrink` "2,309 → ~70
  after SLATE" in one step vs "2,309 → ~400 after AUDIO" (two steps, two labels) → `sort-buckets`
  only if it adds something new (e.g. "good first word" vs "good *second* word": SLATE/CRANE/TRACE
  vs words that reuse letters) — otherwise 3 challenges.
- **L2 Keep one and learn its replies** — `tile-paint` SLATE vs STAGE → `guess-next` SLATE came back
  all grey: pick the follow-up (CRONY / BUILD-style with fresh letters vs a word that reuses S,L,A,T,E)
  → `guess-next` SLATE gave yellow A and green E: pick from three (one reuses the known letters in
  new spots + fresh ones; one wastes a slot; one ignores the E). The point: a fixed first word means
  you have seen its patterns before.

### M3 · Reading the board as a filter — 3 lessons (the core skill)
- **L1 Every row is a filter** — `word-survivors` STARE → yellow R only, 10 words, which survive →
  `multiple-choice` "how many words could still be the answer here: about 30 / 300 / 1,000" (teach the
  scale) → `pool-shrink` the same game: 2,309 → after STARE → after the second guess → 1.
- **L2 Fresh letters first** — `letter-picker` after STARE (R yellow): a word with five *new* letters
  (accept a real list: CLOUD, MOUND, BUILD, …; the component greys out known letters) →
  `guess-next` compare a fresh-letter word vs one that re-tests A and E (patterns real) →
  `tile-paint` the chosen follow-up vs the real answer.
- **L3 Where a letter sits** — `tile-paint` PEARS vs PEARL, then `tile-paint` SPEAR vs PEARL is a
  repeat of the kind — so instead: `tile-paint` PEARS vs PEARL → `multiple-choice` which first word
  to prefer, PEARS or SPEAR, and why (letters in their usual spots: S first, E second…) →
  `guess-next` SLATE gave yellow L (pos 2) and yellow T (pos 4): pick the guess that moves L and T to
  new spots (upgrade yellows to greens).

### M4 · Gather clues or go for it — 3 lessons
- **L1 The probe** — `reveal` what a probe is (a word you know is *not* the answer, played to test
  letters) with a picture → `multiple-choice` CRANE gave yellow A + yellow N, ~47 words left: play a
  likely answer or a probe like SPILT/BOUGH → `pool-shrink` what each choice does to the 47.
- **L2 Two left — split them** — `multiple-choice` BATCH vs CATCH: which word tells them apart
  (BOOBY-style word containing B or C but not both …) → `word-survivors` "tap every word that would
  split BATCH / CATCH / HATCH / LATCH" (contains two of B,C,H,L in different spots) → `guess-next`
  HASTE / PASTE / TASTE with 2 guesses left: the splitter.
- **L3 The last guess** — `multiple-choice` guess 6, three candidates: you must guess one (probing
  now loses) → `guess-next` guess 5, same three: probe first → `sort-buckets` "probe now" vs "guess
  now" for six situations (words left × guesses left), e.g. "2 left, 2 guesses", "40 left, 5
  guesses", "3 left, 1 guess".

### M5 · Traps — 2 lessons
- **L1 The -ATCH family** — `sort-buckets` fits _ATCH / doesn't (BATCH CATCH HATCH LATCH MATCH PATCH
  WATCH vs look-alikes) → `multiple-choice` you have _ATCH on guess 3: which word tests the most of
  B,C,H,L,M,P,W at once (real counts) → `pool-shrink` 7 → 2 → 1 with that word.
- **L2 Spot a trap early** — `word-survivors` _IGHT: which fit (EIGHT FIGHT LIGHT MIGHT NIGHT RIGHT
  SIGHT TIGHT WIGHT) → `guess-next` _OUND / _ILLY / _ATCH-type situation on guess 2: pick the word
  that tests several family letters instead of guessing one member → `multiple-choice` recognise the
  family from the pattern alone (green pattern ·IGHT shown).

### M6 · Hard mode — 2 lessons
- **L1 The rule** — `reveal` what hard mode forces (greens stay, yellows must be used) with CRANE →
  green E → `word-survivors` which next guesses are legal after yellow R + green E (pos 5) →
  `multiple-choice` TARES vs STORM gave yellows T, R, S: what must guess 2 contain.
- **L2 Hard mode changes the plan** — `multiple-choice` which first word leaves good legal follow-ups
  (SLATE vs a word whose greens pin you) → `guess-next` you hit _ATCH on guess 2 in hard mode: best
  legal move (you cannot probe; pick the member that overlaps most with the others) → `sort-buckets`
  legal / illegal moves given a specific board.

### M7 · The numbers behind the review — 1 lesson
- **L1 What the review is telling you** — `pool-shrink` a real 3-guess solve with the words left at
  each step (2,309 → 78 → 3 → 1) and the label "that narrowing is what *Skill* measures" →
  `multiple-choice` SALET leaves about 60 of 2,309: that is roughly a half? a tenth? a fortieth?
  (teach "bits" in one line: each halving is one bit; 2,309 → 60 is ~5 bits) → `multiple-choice`
  two games, same word, same number of guesses: one got lucky tiles, one made better choices — which
  gets the higher Skill score? (ties to Skill vs Luck on the review page) → finale `reveal`
  "You know everything the engine knows. Go play." (the only exclamation-free finale, with a
  "Play the daily word" feel — the runner shows Continue).

Total: 7 modules, 15 lessons, ~55 challenges, kinds spread: tile-paint 7, multiple-choice ~15,
guess-next 8, word-survivors 6, sort-buckets 4, pool-shrink 6, letter-picker 2, tile-tap 1,
reveal 4.
