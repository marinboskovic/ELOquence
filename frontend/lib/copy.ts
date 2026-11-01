/**
 * The product's vocabulary — one place that decides what things are called and
 * how they are explained to someone who has never heard of information theory.
 *
 * Rules (see DESIGN.md §6 Voice):
 *  - `name` is what the UI shows. Plain English, no jargon in Simple view.
 *  - `simple` is the one-line meaning a beginner reads first.
 *  - `detail` is the precise definition, shown in Detailed view and in hints.
 *  - Numbers always come with words: "cut 2,309 words to 78", not "4.9 bits".
 */
import type { Classification, GameMode } from './types';

/* ───────────── Game modes ───────────── */
export const MODES: Record<GameMode, { name: string; short: string; tagline: string; note: string; rated: boolean }> = {
  daily: {
    name: 'Daily',
    short: 'Daily',
    tagline: 'One word a day — the same one for everyone.',
    note: 'Free, keeps your streak going, does not change your rating.',
    rated: false,
  },
  competitive: {
    name: 'Ranked',
    short: 'Ranked',
    tagline: 'A random word. Win and your rating goes up.',
    note: 'Your first 5 ranked games set your starting rating.',
    rated: true,
  },
  practice: {
    name: 'Practice',
    short: 'Practice',
    tagline: 'Play as much as you like. Nothing is recorded.',
    note: 'Good for trying a new first word.',
    rated: false,
  },
  challenge: {
    name: 'Friends',
    short: 'Friends',
    tagline: 'Pick a word, send a link, see who solves it faster.',
    note: 'Same word for everyone, separate boards.',
    rated: false,
  },
};

/* ───────────── Stats & concepts ───────────── */
export interface Term {
  /** What the UI shows. */
  name: string;
  /** One sentence a beginner reads first. */
  simple: string;
  /** The precise definition (Detailed view / hint body). */
  detail: string;
  /** Unit label for numbers, if any. */
  unit?: string;
}

export const TERMS = {
  rating: {
    name: 'Rating',
    simple: 'Your skill level as a number. Everyone starts at 800.',
    detail:
      'An Elo rating. Every answer word has a rating too, learned from thousands of games. Beat a hard word quickly and yours goes up; miss an easy one and it goes down. Only Ranked games count.',
  },
  placement: {
    name: 'First 5 games',
    simple: 'Your first five ranked games decide your starting rating.',
    detail: 'During your first five Ranked games the rating moves faster so it can find your level quickly. After that it settles down.',
  },
  skill: {
    name: 'Skill',
    simple: 'How good your guesses were, ignoring luck.',
    detail:
      '0–100. Each guess is compared with the best possible guess at that moment — how much of the remaining word list it could rule out. Lucky tiles do not help this score; smart guesses do.',
  },
  luck: {
    name: 'Luck',
    simple: 'How kindly the tiles fell.',
    detail:
      '0–100. Compares how many words were actually left after each guess with how many you could expect on average. Above 50 means the hidden word landed in a small group more often than it should have.',
  },
  information: {
    name: 'Narrowing',
    simple: 'How much a guess shrank the list of possible answers.',
    detail:
      'Measured in bits. One bit halves the list: 2,309 possible answers → 1,154 is one bit. A great first word earns about 5.9 bits, leaving ~60 words.',
    unit: 'bits',
  },
  wordsLeft: {
    name: 'Words left',
    simple: 'How many answers were still possible after this guess.',
    detail: 'The number of words in the official answer list that still fit every clue so far.',
  },
  opener: {
    name: 'First word',
    simple: 'The word you start with. A strong one rules out more letters.',
    detail: 'Ranked by how evenly it splits the 2,309 answers into colour patterns. SOARE, ROATE and SLATE are among the best.',
  },
  wordRating: {
    name: 'Word difficulty',
    simple: 'How hard this word has been for other players.',
    detail: 'Each answer has its own Elo rating, learned from every game played on it. 1,200+ is hard.',
  },
  hardMode: {
    name: 'Hard mode',
    simple: 'You must reuse every clue you have found.',
    detail: 'Green letters must stay in place and yellow letters must be used again. It stops you from "probing" with throw-away words.',
  },
  streak: {
    name: 'Streak',
    simple: 'Days in a row you solved the Daily.',
    detail: 'Replays of past days do not count.',
  },
  accuracy: {
    name: 'Accuracy',
    simple: 'Share of your guesses that were close to the best choice.',
    detail: 'Average of the per-guess skill scores across a game.',
  },
  season: {
    name: 'Season',
    simple: 'A monthly ladder. Everyone starts fresh.',
    detail: 'The season ladder ranks players by rating gained this month, so new players can place.',
  },
} satisfies Record<string, Term>;

export type TermKey = keyof typeof TERMS;

/* ───────────── Move classifications ───────────── */
export const MOVE_CLASS: Record<Classification, { label: string; simple: string; tone: 'great' | 'good' | 'neutral' | 'bad' | 'worse' }> = {
  brilliant: { label: 'Brilliant', simple: 'Better than the engine expected', tone: 'great' },
  best: { label: 'Best', simple: 'The strongest guess available', tone: 'great' },
  good: { label: 'Good', simple: 'Close to the best', tone: 'good' },
  okay: { label: 'Fine', simple: 'Reasonable, some room to improve', tone: 'neutral' },
  inaccuracy: { label: 'Slightly off', simple: 'A better word was available', tone: 'neutral' },
  mistake: { label: 'Costly', simple: 'Left many more words than needed', tone: 'bad' },
  blunder: { label: 'Big miss', simple: 'Ignored clues you already had', tone: 'worse' },
  miss: { label: 'Missed win', simple: 'The answer was findable here', tone: 'worse' },
  forced: { label: 'Only option', simple: 'No better guess existed', tone: 'neutral' },
};

/* ───────────── Rating tiers ───────────── */
export const TIER_COPY: Record<string, { simple: string }> = {
  Novice: { simple: 'Everyone starts here.' },
  Veteran: { simple: 'Beats most words in 4.' },
  Master: { simple: 'Rarely needs a 5th guess.' },
  Grandmaster: { simple: 'Top of the ladder.' },
};

/* ───────────── Plain-language helpers ───────────── */
export const fmtInt = (n: number) => n.toLocaleString('en-US');

/** "cut 2,309 words to 78" — the beginner-friendly way to say "4.9 bits". */
export function narrowing(before: number, after: number): string {
  return `${fmtInt(before)} → ${fmtInt(after)} words`;
}

/** Rating change with sign, or a dash when the game was unrated. */
export function ratingDelta(delta: number | null | undefined): string {
  if (delta == null) return '—';
  const r = Math.round(delta);
  return r > 0 ? `+${r}` : `${r}`;
}

/** Plain sentence for a game result. */
export function resultSentence(status: 'won' | 'lost' | 'in_progress' | 'abandoned', guesses?: number | null): string {
  if (status === 'won') return guesses ? `Solved in ${guesses}` : 'Solved';
  if (status === 'lost') return 'Not solved';
  if (status === 'abandoned') return 'Left unfinished';
  return 'In progress';
}
