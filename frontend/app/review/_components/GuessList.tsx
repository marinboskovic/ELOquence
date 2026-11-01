'use client';
/**
 * Simple view: one row per guess. Tiles, the classification as a tag, the
 * one-line meaning, and how far the guess narrowed the list — in words.
 */
import { Label, MiniTiles } from '@/components/ui';
import { MOVE_CLASS, fmtInt, narrowing } from '@/lib/copy';
import { patternToTiles, type AnalysisResult } from '@/lib/types';
import MoveTag from './MoveTag';
import { SOLVED_PATTERN, betterWord, remainingAfter, remainingBefore } from './takeaway';

export default function GuessList({ analysis }: { analysis: AnalysisResult }) {
  return (
    <ol className="flex flex-col" aria-label="Guess by guess">
      {analysis.moves.map((m) => {
        const tiles = patternToTiles(m.pattern).map((t) => (t === 'tbd' ? 'empty' : t));
        const solved = m.pattern === SOLVED_PATTERN;
        const before = remainingBefore(m, analysis);
        const after = remainingAfter(m);
        const alt = betterWord(m);
        const cls = m.classification ? MOVE_CLASS[m.classification] : null;

        let narrowed: string;
        if (solved) narrowed = `Solved in ${m.move_number}`;
        else if (before != null && after != null) narrowed = narrowing(before, after);
        else if (after != null) narrowed = `${fmtInt(after)} words left`;
        else narrowed = '';

        return (
          <li
            key={m.move_number}
            id={`guess-${m.move_number}`}
            className="rule-hair py-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2 items-start scroll-mt-20"
          >
            <div className="flex flex-col gap-1.5">
              <Label>guess {m.move_number}</Label>
              <MiniTiles word={m.guess_word} states={tiles} size={26} gap={3} />
            </div>

            <div className="min-w-0 flex flex-col gap-1.5 pt-0.5">
              <div className="flex items-center gap-2.5 flex-wrap">
                {m.classification && <MoveTag classification={m.classification} />}
                {cls && <span className="font-sans text-sm text-text-primary">{cls.simple}.</span>}
              </div>
              <div className="font-mono text-xs tabular text-text-secondary flex items-center gap-x-4 gap-y-1 flex-wrap">
                {narrowed && <span>{narrowed}</span>}
                {alt && (
                  <span>
                    Better: <span className="font-display font-bold tracking-wide text-text-primary">{alt}</span>
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
