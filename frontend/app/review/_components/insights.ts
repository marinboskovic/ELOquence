/**
 * Plain-language helpers for the review page. Pure functions over the
 * analysis payload — nothing here invents data: every sentence is built from
 * fields that `lib/types.ts` says the API returns, and falls back to a shorter
 * sentence when an optional field is missing.
 */
import { MOVE_CLASS, fmtInt } from '@/lib/copy';
import type { AnalysisResult, Classification, Game, MoveAnalysis } from '@/lib/types';

/** Pattern value for five green tiles. */
export const SOLVED_PATTERN = 242;

export type MoveTone = 'green' | 'neutral' | 'bad';

/** Collapse the five MOVE_CLASS tones into the three the review uses. */
export function moveTone(c: Classification | null | undefined): MoveTone {
  if (!c) return 'neutral';
  const t = MOVE_CLASS[c].tone;
  if (t === 'great' || t === 'good') return 'green';
  if (t === 'bad' || t === 'worse') return 'bad';
  return 'neutral';
}

/** How many answers were still possible before this guess. */
export function remainingBefore(m: MoveAnalysis, analysis: AnalysisResult): number | null {
  if (m.remaining_before != null) return m.remaining_before;
  if (m.remaining_words != null) return m.remaining_words;
  const idx = analysis.moves.findIndex((x) => x.move_number === m.move_number);
  const prev = idx > 0 ? analysis.moves[idx - 1] : null;
  if (prev && prev.remaining_after != null) return prev.remaining_after;
  if (m.move_number === 1 && analysis.dictionary_sizes?.solutions) return analysis.dictionary_sizes.solutions;
  return null;
}

/** How many answers were still possible after this guess. */
export function remainingAfter(m: MoveAnalysis): number | null {
  if (m.pattern === SOLVED_PATTERN) return 0;
  return m.actual_solutions_after ?? m.remaining_after ?? null;
}

/** The engine's preferred word for this turn, if it differs from what was played. */
export function betterWord(m: MoveAnalysis): string | null {
  const alt = m.optimal_word ?? m.bot_pick ?? null;
  if (!alt) return null;
  if (alt.toUpperCase() === m.guess_word.toUpperCase()) return null;
  if (m.classification === 'forced') return null;
  if (moveTone(m.classification) === 'green') return null;
  return alt.toUpperCase();
}

/** What the better word would have left — the real number if we have it, else the average. */
export function betterWordLeft(m: MoveAnalysis): { n: number; exact: boolean } | null {
  if (m.optimal_actual_solutions_after != null) return { n: m.optimal_actual_solutions_after, exact: true };
  if (m.optimal_expected_remaining != null) return { n: Math.round(m.optimal_expected_remaining), exact: false };
  return null;
}

/* ───────────── The one takeaway ───────────── */

const SEVERITY: Partial<Record<Classification, number>> = {
  miss: 5,
  blunder: 5,
  mistake: 4,
  inaccuracy: 3,
  okay: 2,
};

/** "was Costly", "was a Big miss" — the label with the article it needs. */
function labelWithArticle(c: Classification): string {
  const label = MOVE_CLASS[c].label;
  switch (c) {
    case 'blunder':
    case 'miss':
      return `a ${label}`;
    default:
      return label;
  }
}

function subject(m: MoveAnalysis): string {
  const word = m.guess_word.toUpperCase();
  return m.move_number === 1 ? `Your first word, ${word},` : `Guess ${m.move_number}, ${word},`;
}

const plural = (n: number) => (n === 1 ? 'word' : 'words');

/**
 * The single most useful sentence about this game.
 * Picks the worst-classified guess; ties go to the one that left more words.
 */
export function buildTakeaway(analysis: AnalysisResult, game: Game | null): string {
  const moves = analysis.moves;
  const won = game?.status === 'won';
  const target = game?.target_word ? game.target_word.toUpperCase() : null;

  let worst: MoveAnalysis | null = null;
  let worstRank = 0;
  for (const m of moves) {
    const rank = m.classification ? SEVERITY[m.classification] ?? 0 : 0;
    if (rank > worstRank || (rank === worstRank && rank > 0 && worst && (remainingAfter(m) ?? 0) > (remainingAfter(worst) ?? 0))) {
      worst = m;
      worstRank = rank;
    }
  }

  if (!worst || worstRank === 0) {
    if (won) return 'Clean game. Every guess was close to the best choice.';
    if (game?.status === 'lost') return 'Every guess was close to the best choice — the tiles simply fell against you.';
    return 'Every guess was close to the best choice.';
  }

  const c = worst.classification as Classification;
  const left = remainingAfter(worst);
  const alt = betterWord(worst);
  const altLeft = alt ? betterWordLeft(worst) : null;
  const before = remainingBefore(worst, analysis);

  if (c === 'miss') {
    if (target && before != null) {
      return `${subject(worst)} was a Missed win — the answer, ${target}, was already one of only ${fmtInt(before)} ${plural(before)} left.`;
    }
    return `${subject(worst)} was a Missed win — the answer could already have been found here.`;
  }

  const leftClause = left != null ? `it left ${fmtInt(left)} ${plural(left)}` : 'a better word was available';
  let altClause = '';
  if (alt && altLeft && left != null) {
    altClause = altLeft.exact
      ? ` when ${alt} would have left ${fmtInt(altLeft.n)}`
      : ` when ${alt} would have left about ${fmtInt(altLeft.n)} on average`;
  } else if (alt) {
    altClause = `. ${alt} was the stronger choice`;
  }

  if (worstRank === 2) {
    const okays = moves.filter((m) => m.classification === 'okay').length;
    const opener = okays > 1 ? 'Solid game. A few guesses had room to improve: ' : 'Solid game. Only one guess had room to improve: ';
    const body = alt && altLeft && left != null
      ? `on guess ${worst.move_number}, ${alt} would have left ${fmtInt(altLeft.n)} ${plural(altLeft.n)} instead of ${fmtInt(left)}.`
      : alt
      ? `on guess ${worst.move_number}, ${alt} was the stronger choice.`
      : `guess ${worst.move_number} left more words than it needed to.`;
    return opener + body;
  }

  return `${subject(worst)} was ${labelWithArticle(c)} — ${leftClause}${altClause}.`;
}

/* ───────────── Sentences for the two headline numbers ───────────── */

export function skillSentence(skill: number): string {
  if (skill >= 90) return 'Your guesses were close to the best choice.';
  if (skill >= 70) return 'Mostly strong guesses, with a better word available once or twice.';
  if (skill >= 50) return 'Decent guesses, but better words were often available.';
  return 'Several guesses left many more words than they needed to.';
}

export function luckSentence(luck: number): string {
  if (luck >= 65) return 'The tiles fell kindly — the answer kept landing in small groups.';
  if (luck >= 45) return 'About average — the tiles fell roughly as expected.';
  return 'The tiles fell against you — the answer kept hiding in big groups.';
}

/** Headline Skill: 0–100. */
export function headlineSkill(analysis: AnalysisResult): number {
  return Math.round(analysis.skill_avg ?? analysis.skill_avg_excluding_opener ?? analysis.accuracy_score ?? 0);
}

/** Headline Luck: 0–100. */
export function headlineLuck(analysis: AnalysisResult): number {
  return Math.round(analysis.luck_avg ?? analysis.luck_factor ?? 0);
}

/* ───────────── Coach prompts in plain words ───────────── */

export function coachPrompts(analysis: AnalysisResult | null): string[] {
  const prompts: string[] = [];
  if (analysis) {
    let worst: MoveAnalysis | null = null;
    let rank = 0;
    for (const m of analysis.moves) {
      const r = m.classification ? SEVERITY[m.classification] ?? 0 : 0;
      if (r > rank) {
        worst = m;
        rank = r;
      }
    }
    if (worst && rank >= 3) {
      prompts.push(`Why was guess ${worst.move_number} ${MOVE_CLASS[worst.classification as Classification].label.toLowerCase()}?`);
    }
  }
  prompts.push('What should I open with next time?');
  prompts.push('Which guess cost me the most?');
  prompts.push('How do I make better use of yellow letters?');
  return prompts.slice(0, 3);
}
