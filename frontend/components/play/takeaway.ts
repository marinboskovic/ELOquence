/**
 * Plain-language helpers for the play flow (mode row, game header, game over).
 * Everything here reads data the game response already carries — no extra
 * API calls, no invented numbers.
 */
import { MOVE_CLASS } from '@/lib/copy';
import type { Classification, Game, Move } from '@/lib/types';

/** "1st", "2nd", "3rd", "4th"… */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Worst first — the order we rank a game's guesses in to find the takeaway. */
const SEVERITY: Classification[] = ['miss', 'blunder', 'mistake', 'inaccuracy', 'okay', 'forced', 'good', 'best', 'brilliant'];
const NEEDS_WORK = new Set<Classification>(['miss', 'blunder', 'mistake', 'inaccuracy']);

export function sortedMoves(game: Pick<Game, 'moves'>): Move[] {
  return [...(game.moves ?? [])].sort((a, b) => a.move_number - b.move_number);
}

/**
 * ONE sentence a beginner can act on, built from the per-move classification
 * the server attached to each guess. Returns null when no guess was classified.
 */
export function takeaway(game: Pick<Game, 'moves' | 'status'>): string | null {
  const moves = sortedMoves(game).filter((m) => m.classification && MOVE_CLASS[m.classification]);
  if (moves.length === 0) return null;

  const worst = moves.reduce((acc, m) => {
    const a = SEVERITY.indexOf(acc.classification as Classification);
    const b = SEVERITY.indexOf(m.classification as Classification);
    return b < a ? m : acc;
  });
  const cls = worst.classification as Classification;
  const label = MOVE_CLASS[cls].label;

  if (NEEDS_WORK.has(cls)) {
    const better = worst.optimal_word && worst.optimal_word.toUpperCase() !== worst.guess_word.toUpperCase()
      ? ` — a better word was ${worst.optimal_word.toUpperCase()}`
      : '';
    const article = cls === 'miss' ? 'a ' : '';
    return `Your ${ordinal(worst.move_number)} guess was ${article}${label}${better}.`;
  }

  // Nothing to fix — say so in the same voice.
  const onlyWord = moves.length === 1;
  return onlyWord ? `Your first word was ${label}.` : `Every guess was ${label} or better.`;
}

/** Words still possible after the latest guess, if the server told us. */
export function wordsLeftAfterLastGuess(game: Pick<Game, 'moves'> | null): number | null {
  if (!game) return null;
  const moves = sortedMoves(game);
  const last = moves[moves.length - 1];
  return last?.remaining_words ?? null;
}

/** Total narrowing in bits across the game (Detailed view only). */
export function totalBits(game: Pick<Game, 'moves'>): number | null {
  const vals = sortedMoves(game).map((m) => m.info_gained).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0);
}

/** "Saturday 1 November" for a Daily header, from the game's creation date. */
export function dailyDateLabel(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return safe.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
