import type { TileState } from '../_components/TileRow';

/** Compact pattern literal for lesson data: 'G' green, 'Y' yellow, '.' grey, '_' empty.
 *  Every literal used in a lesson is verified against real Wordle scoring by the
 *  verification script (see CURRICULUM.md). */
export function P(s: string): TileState[] {
  return s.split('').map((c) =>
    c === 'G' ? 'correct' : c === 'Y' ? 'present' : c === '_' ? 'empty' : 'absent',
  );
}
