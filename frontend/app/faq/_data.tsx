'use client';
/**
 * The full Help manual — every question, kept for the "nerd corner" at the bottom of
 * the Help page and for search. Beginners never see this first; see page.tsx and
 * _chapters.tsx for the short tour.
 */
import {
  BookOpen,
  BarChart2,
  Brain,
  Zap,
  Target,
  MessageSquare,
  TrendingUp,
  Star,
  Sun,
  Swords,
  FlaskConical,
  FileText,
  Users,
} from 'lucide-react';
import { Hint, MiniTiles, Tag } from '@/components/ui';
import { MODES, MOVE_CLASS, TERMS, TIER_COPY } from '@/lib/copy';
import type { Classification } from '@/lib/types';
import clsx from 'clsx';

/* ------------------------------------------------------------------ */
/*  Shared primitives (carried over)                                    */
/* ------------------------------------------------------------------ */

type FaqTileColor = 'green' | 'yellow' | 'gray' | 'empty';
const FAQ_STATE: Record<FaqTileColor, 'correct' | 'present' | 'absent' | 'empty'> = {
  green: 'correct',
  yellow: 'present',
  gray: 'absent',
  empty: 'empty',
};

function Tile({
  letter,
  color,
  size = 'md',
}: {
  letter: string;
  color: FaqTileColor;
  size?: 'sm' | 'md';
}) {
  return <MiniTiles word={letter} states={[FAQ_STATE[color]]} size={size === 'sm' ? 28 : 32} className="align-middle" />;
}

export function TileRow({
  word,
  pattern,
}: {
  word: string;
  pattern: FaqTileColor[];
}) {
  return <MiniTiles word={word} states={pattern.map((c) => FAQ_STATE[c])} size={28} gap={4} />;
}

/** Move-label tag — the wording and tone come from MOVE_CLASS so Help says the same thing as the review page. */
function classTone(key: Classification): 'green' | 'ochre' | 'accent' | 'neutral' {
  const t = MOVE_CLASS[key].tone;
  if (t === 'great' || t === 'good') return 'green';
  if (t === 'bad' || t === 'worse') return 'accent';
  return key === 'forced' ? 'neutral' : 'ochre';
}
function classVar(key: Classification): string {
  if (key === 'brilliant') return 'var(--cls-blue)';
  if (key === 'best' || key === 'good') return 'var(--tile-correct)';
  if (key === 'okay' || key === 'inaccuracy') return 'var(--tile-present)';
  if (key === 'mistake') return 'var(--cls-orange)';
  if (key === 'blunder' || key === 'miss') return 'var(--cls-red)';
  return 'var(--text-tertiary)';
}

export function ClassBadge({ cls }: { cls: Classification }) {
  return (
    <Tag tone={classTone(cls)} className="align-middle">
      {MOVE_CLASS[cls].label}
    </Tag>
  );
}

function EfficiencyBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 relative h-[2px]">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-subtle" aria-hidden="true" />
        <div className="absolute inset-y-0 left-0" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-[10px] tabular text-text-tertiary w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

export function MiniSparkline() {
  const points = [1000, 1024, 1018, 1057, 1045, 1089, 1076, 1102, 1098, 1134];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const h = 32;
  const w = 140;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * (h - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="block" aria-hidden="true">
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="var(--text-primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect
        x={w - 3}
        y={parseFloat(coords[coords.length - 1].split(',')[1]) - 3}
        width={6}
        height={6}
        fill="var(--accent)"
      />
    </svg>
  );
}

function InnerCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rule-hair pt-3 pb-3', className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface FAQItem {
  q: string;
  a: React.ReactNode;
  plain: string;
}

export interface SectionDef {
  slug: string;
  title: string;
  icon: React.ReactNode;
  intro?: string;
  items: FAQItem[];
}

/** "Part 01", "Part 02", … from the section's position — sections are ordered beginner-first. */
export const partLabel = (i: number) => `Part ${String(i + 1).padStart(2, '0')}`;

/* ------------------------------------------------------------------ */
/*  Section data                                                        */
/* ------------------------------------------------------------------ */

export const SECTIONS: SectionDef[] = [
  /* ============================== 1. THE BASICS ============================== */
  {
    slug: 'basics',
    title: 'The basics',
    icon: <BookOpen size={16} />,
    intro: 'New here? Start with these.',
    items: [
      {
        q: 'What is ELOquence?',
        plain:
          'ELOquence is a Wordle analyzer that reviews every guess you make, scores your skill and luck separately, and tracks your improvement over time with a rating. Think of it as a chess engine but for Wordle — it tells you what the optimal play was, how close you came, and why.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              ELOquence is a Wordle analyzer that reviews every guess you make, scores your skill
              and luck separately, and tracks your improvement over time with a rating. Think
              of it as a chess engine but for Wordle — it tells you what the optimal play was, how
              close you came, and why.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Nope, ELOquence doesn&apos;t pick the daily word — it analyzes whatever you played.
              The word comes from the same place it always has. We just have opinions about how you
              handled it.
            </p>
          </div>
        ),
      },
      {
        q: 'How do I play?',
        plain:
          'Same as regular Wordle: guess a five-letter word, get green/yellow/gray feedback, and try to solve in six guesses. After you finish, ELOquence breaks down every move. Green means the right letter in the right spot. Yellow means the letter is in the word but in a different position. Gray means the letter is not in the word at all.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Same as regular Wordle: guess a five-letter word, get green/yellow/gray feedback, and
              try to solve in six guesses. After you finish, ELOquence breaks down every move.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-tertiary uppercase tracking-wider">
                What the colors mean
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Tile letter="C" color="green" size="sm" />
                  <span className="font-sans text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Green</span> — right letter,
                    right position.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Tile letter="R" color="yellow" size="sm" />
                  <span className="font-sans text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Yellow</span> — right letter,
                    wrong position.
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Tile letter="A" color="gray" size="sm" />
                  <span className="font-sans text-xs text-text-secondary">
                    <span className="font-semibold text-text-primary">Gray</span> — letter not in
                    the word.
                  </span>
                </div>
              </div>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What do the colored tiles mean?',
        plain:
          'Green means the letter is correct and in the right position. Yellow means the letter is in the word but placed incorrectly. Gray means the letter does not appear in the word at all. Pay close attention to yellows — they are the most commonly wasted clues.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Wordle&apos;s color system is a binary signal at each position. Here&apos;s a worked
              example where the answer is CRANE:
            </p>
            <InnerCard className="space-y-2.5">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
                  <span className="font-sans text-[10px] text-text-tertiary">
                    A and E are in CRANE, wrong spots
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <TileRow word="CRANE" pattern={['green', 'green', 'green', 'green', 'green']} />
                  <span className="font-sans text-[10px] text-text-tertiary">Solved!</span>
                </div>
              </div>
            </InnerCard>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              Pay close attention to yellows — they are the most commonly wasted clues.
              Ignoring a yellow and guessing that letter in the same wrong position again is a
              constraint violation, and the analysis will call it out.
            </p>
          </div>
        ),
      },
      {
        q: 'Should I sign in?',
        plain:
          'No account is needed to read this page, play the Daily, Practice, use Learn or the Word Lab. Signing in gives you a rating, Ranked games, your game history, Coach Chat and your profile. It is free and takes about ten seconds.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Not to read this page, play the Daily or Practice, or use Learn and the Word Lab. Signing
            in gives you a rating, Ranked games, your game history, Coach Chat and a profile that
            follows you across devices. It&apos;s free and takes about ten seconds.
          </p>
        ),
      },
    ],
  },

  /* ============================== 2. WHAT THE SCORES MEAN ============================== */
  {
    slug: 'scores',
    title: 'What the scores mean',
    icon: <BarChart2 size={16} />,
    intro: 'Skill, luck, first word, narrowing — every number on a review page, in one sentence each.',
    items: [
      {
        q: 'What are skill, luck and first word?',
        plain: `Skill: ${TERMS.skill.simple} Luck: ${TERMS.luck.simple} First word: ${TERMS.opener.simple} Three numbers, three different questions about the same game.`,
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Three numbers, three different questions about the same game.
            </p>
            <div className="grid gap-2">
              {(
                [
                  { key: 'skill', range: '0–100' },
                  { key: 'luck', range: '0–100' },
                  { key: 'opener', range: null },
                ] as const
              ).map((s) => {
                const t = TERMS[s.key];
                return (
                  <InnerCard key={s.key} className="flex gap-3 items-start">
                    <Tag className="shrink-0 mt-0.5">
                      {t.name}
                      {s.range ? ` ${s.range}` : ''}
                    </Tag>
                    <div>
                      <p className="font-sans text-xs text-text-primary leading-relaxed">{t.simple}</p>
                      <p className="font-sans text-xs text-text-secondary leading-relaxed mt-0.5">{t.detail}</p>
                    </div>
                  </InnerCard>
                );
              })}
            </div>
          </div>
        ),
      },
      {
        q: 'What does the Skill score mean exactly?',
        plain:
          'Skill is how good your guesses were, ignoring luck. It starts at 100 and drops for every guess that falls short of the best choice available at that moment. Make the best guess every time and you score 100. One poor guess in a short, lucky game can still leave you around 70. The first word does not count.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <Hint term="skill" /> is {TERMS.skill.simple.charAt(0).toLowerCase() + TERMS.skill.simple.slice(1)} It
              starts at 100 and drops for every guess that falls short of the best choice available at that moment. The
              gap between your guess and the best one decides how many points come off. Make the best guess every time
              and you score 100; one poor guess in a short, lucky game can still leave you around 70.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The score is averaged across your guesses (the first word is left out), weighted by how much was at stake.
              A poor guess with 30 words left costs more than the same guess with 500 left — you had better clues and
              still missed.
            </p>
            <InnerCard>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                <span className="font-semibold text-text-primary">Note:</span> Skill only counts guesses where you had
                a real choice. If only one word could still be the answer, the guess is marked{' '}
                <ClassBadge cls="forced" /> and skipped — no credit, no penalty.
              </p>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What does the Luck score mean?',
        plain:
          'Luck is how kindly the tiles fell. The same guess can come back all gray (nothing learned) or almost all green (nearly solved). Luck compares how many words were actually left after each guess with how many you could expect on average. Above 50 means the hidden word landed in a small group more often than it should have.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <Hint term="luck" /> is {TERMS.luck.simple.charAt(0).toLowerCase() + TERMS.luck.simple.slice(1)} Say you
              start with CRANE. It could come back all gray (bad luck, nothing learned) or all green (lucky break, word
              solved). Same guess, wildly different outcomes. The luck score measures that difference.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">{TERMS.luck.detail}</p>
            <InnerCard>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                CRANE came back with four green tiles? That is high luck, not high skill. They look the same from the
                outside — your review tells you which one it was.
              </p>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What does the First word line mean?',
        plain:
          'It shows the word you started with and how many other players started differently. Most people open with CRANE, SLATE or SALET, so anything else counts as rare. Rare is not better or worse — to see how strong a first word actually is, try it in the Word Lab.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <Hint term="opener" /> shows the word you started with and what share of other players started with
              something else. Most people open with CRANE, SLATE or SALET, so anything else reads as rare. Rare is not
              better or worse — it just says how unusual your start was.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              {TERMS.opener.simple} To see how strong yours actually is, type it into the{' '}
              <a href="/lab" className="ink-link text-text-primary">
                Word Lab
              </a>
              .
            </p>
          </div>
        ),
      },
      {
        q: 'What is narrowing, and what are "words left"?',
        plain:
          'Narrowing is how much a guess shrank the list of possible answers. There are 2,309 possible answers; a good first word leaves about 60 of them. Words left is how many answers were still possible after a guess. In Detailed view narrowing is measured in bits: one bit halves the list.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <Hint term="information" /> is{' '}
              {TERMS.information.simple.charAt(0).toLowerCase() + TERMS.information.simple.slice(1)} There are 2,309
              possible answers at the start. A good first word leaves about 60 of them; a weak one leaves a few hundred.
              The review shows this as plain counts: <span className="font-mono text-text-primary">2,309 → 78 words</span>.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <Hint term="wordsLeft" /> is {TERMS.wordsLeft.simple.charAt(0).toLowerCase() + TERMS.wordsLeft.simple.slice(1)}{' '}
              Fewer is better, and reaching one means your next guess is the answer.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-secondary uppercase tracking-wider">Example — SALET as a first word</p>
              <div className="flex items-center gap-3">
                <TileRow word="SALET" pattern={['gray', 'yellow', 'gray', 'yellow', 'gray']} />
                <ClassBadge cls="best" />
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-sans text-xs mt-1">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Words left</span>
                  <span className="font-mono text-text-primary">2,309 → 53</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Narrowing (bits)</span>
                  <span className="font-mono text-text-primary">5.43</span>
                </div>
              </div>
              <EfficiencyBar pct={97} color="var(--tile-correct)" />
            </InnerCard>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">In Detailed view</span> narrowing is also shown in bits:
              one bit halves the list, so 2,309 → 1,154 is one bit and a great first word earns about 5.9. The bar above
              is efficiency — how close your narrowing came to the best guess available.
            </p>
          </div>
        ),
      },
      {
        q: 'What do the move labels mean?',
        plain: `Each guess gets a label by comparing it with the best guess available at that moment. ${(
          Object.keys(MOVE_CLASS) as Classification[]
        )
          .map((k) => `${MOVE_CLASS[k].label}: ${MOVE_CLASS[k].simple}.`)
          .join(' ')}`,
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Each guess gets a label by comparing it with the best guess available at that moment. Here is the full
              ladder, from best to worst:
            </p>
            <div className="space-y-1.5">
              {(
                [
                  { cls: 'brilliant', pct: '> 100%', w: 100 },
                  { cls: 'best', pct: '95–100%', w: 97 },
                  { cls: 'good', pct: '85–95%', w: 90 },
                  { cls: 'okay', pct: '70–85%', w: 77 },
                  { cls: 'inaccuracy', pct: '50–70%', w: 60 },
                  { cls: 'mistake', pct: '30–50%', w: 40 },
                  { cls: 'blunder', pct: '< 30%', w: 20 },
                  { cls: 'miss', pct: '—', w: 10 },
                  { cls: 'forced', pct: '—', w: 5 },
                ] as { cls: Classification; pct: string; w: number }[]
              ).map((c) => (
                <div key={c.cls} className="grid grid-cols-[6.5rem_1fr] sm:grid-cols-[6.5rem_1fr_3.5rem] items-center gap-x-2 gap-y-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-right text-text-secondary">
                    {MOVE_CLASS[c.cls].label}
                  </span>
                  <div className="relative h-[2px]">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-subtle" aria-hidden="true" />
                    <div className="absolute inset-y-0 left-0" style={{ width: `${c.w}%`, backgroundColor: classVar(c.cls) }} />
                  </div>
                  <span className="hidden sm:block font-mono text-[9px] tabular text-text-secondary">{c.pct}</span>
                  <span className="col-start-2 sm:col-span-2 font-sans text-xs text-text-secondary">{MOVE_CLASS[c.cls].simple}</span>
                </div>
              ))}
            </div>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              The percentage is efficiency: how much of the best available narrowing your guess achieved.{' '}
              <span className="font-semibold text-text-primary">Brilliant</span> is genuinely rare — it means you found
              a word the engine under-rated. When you see it, it is real.
            </p>
          </div>
        ),
      },
    ],
  },

  /* ============================== 3. MODES & RATING ============================== */
  {
    slug: 'modes',
    title: 'Modes & rating',
    icon: <TrendingUp size={16} />,
    intro: 'Four ways to play, and how the one rated mode moves your number.',
    items: [
      {
        q: 'What modes can I play?',
        plain: `${MODES.daily.name}: ${MODES.daily.tagline} ${MODES.daily.note} ${MODES.competitive.name}: ${MODES.competitive.tagline} ${MODES.competitive.note} ${MODES.practice.name}: ${MODES.practice.tagline} ${MODES.practice.note} ${MODES.challenge.name}: ${MODES.challenge.tagline} ${MODES.challenge.note}`,
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Four modes. Only Ranked changes your rating.
            </p>
            <div className="grid gap-3">
              {(
                [
                  { key: 'daily', icon: <Sun size={15} style={{ color: 'var(--tile-present)' }} className="shrink-0 mt-0.5" /> },
                  { key: 'competitive', icon: <Swords size={15} className="shrink-0 mt-0.5 text-text-secondary" /> },
                  { key: 'practice', icon: <FlaskConical size={15} className="shrink-0 mt-0.5 text-text-secondary" /> },
                  { key: 'challenge', icon: <Users size={15} className="shrink-0 mt-0.5 text-text-secondary" /> },
                ] as const
              ).map((m) => {
                const mode = MODES[m.key];
                return (
                  <InnerCard key={m.key} className="flex gap-3">
                    {m.icon}
                    <div>
                      <p className="font-sans text-xs font-semibold text-text-primary">
                        {mode.name}
                        {mode.rated && (
                          <Tag tone="green" className="ml-2">
                            rated
                          </Tag>
                        )}
                      </p>
                      <p className="font-sans text-xs text-text-secondary mt-0.5 leading-relaxed">
                        {mode.tagline} {mode.note}
                      </p>
                    </div>
                  </InnerCard>
                );
              })}
            </div>
          </div>
        ),
      },
      {
        q: 'What is my rating?',
        plain: `${TERMS.rating.simple} ${TERMS.rating.detail}`,
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <Hint term="rating" /> is {TERMS.rating.simple.charAt(0).toLowerCase() + TERMS.rating.simple.slice(1)}{' '}
              {TERMS.rating.detail}
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-secondary uppercase tracking-wider">
                Example: solving a hard word
              </p>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-display text-lg font-bold text-text-primary">1057</p>
                  <p className="font-sans text-[10px] text-text-secondary">Before</p>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="font-sans text-xs font-bold" style={{ color: 'var(--tile-correct)' }}>+43</span>
                  <div className="w-12 h-px bg-border-subtle" />
                  <span className="font-sans text-[9px] text-text-secondary">Word difficulty 1420</span>
                </div>
                <div className="text-center">
                  <p className="font-display text-lg font-bold" style={{ color: 'var(--tile-correct)' }}>1100</p>
                  <p className="font-sans text-[10px] text-text-secondary">After</p>
                </div>
              </div>
            </InnerCard>
            <p className="font-sans text-xs text-text-secondary leading-relaxed">
              In Detailed view the rating is shown as an Elo number, the same system chess uses.
            </p>
          </div>
        ),
      },
      {
        q: 'What are the tiers?',
        plain:
          'Tiers are rating bands with a name: Novice (up to 1199), Veteran (1200–1399), Master (1400–1599), Grandmaster (1600+). They are milestones — your rating is the real number.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Tiers are rating bands with a name — milestones that mark your progress. Your rating is the real number;
              tiers just give it a name.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Novice', range: 'up to 1199', cls: 'bg-tier-novice' },
                { name: 'Veteran', range: '1200 – 1399', cls: 'bg-tier-veteran' },
                { name: 'Master', range: '1400 – 1599', cls: 'bg-tier-master' },
                { name: 'Grandmaster', range: '1600+', cls: 'bg-tier-grandmaster' },
              ].map((t) => (
                <InnerCard key={t.name} className="flex items-start gap-2 py-2">
                  <span className={clsx('w-2 h-2 rounded-full shrink-0 mt-1', t.cls)} />
                  <div>
                    <span className="font-sans text-xs font-semibold text-text-primary">{t.name}</span>
                    <span className="font-sans text-[10px] text-text-secondary ml-1.5">{t.range}</span>
                    {TIER_COPY[t.name] && (
                      <p className="font-sans text-[11px] text-text-secondary leading-relaxed">{TIER_COPY[t.name].simple}</p>
                    )}
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'What are the first 5 games?',
        plain: `${TERMS.placement.simple} ${TERMS.placement.detail} Want a quick start? Play five Ranked games and let the system find you.`,
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            <Hint term="placement">Your first 5 games</Hint> decide your starting rating. {TERMS.placement.detail} Want
            a quick start? Play five Ranked games and let the system find your level.
          </p>
        ),
      },
      {
        q: 'How is word difficulty worked out?',
        plain: `${TERMS.wordRating.simple} ${TERMS.wordRating.detail} Rare letters, unusual positions, repeated letters and uncommon words all push difficulty up. The number feeds directly into how much rating you gain or lose for that word.`,
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            <Hint term="wordRating" /> is {TERMS.wordRating.simple.charAt(0).toLowerCase() + TERMS.wordRating.simple.slice(1)}{' '}
            {TERMS.wordRating.detail} It starts from how common the letters are, how typical their positions are,
            whether letters repeat and how everyday the word is, then learns from every game played on it. The number
            feeds directly into how much rating you gain or lose: beating a 1,500 word earns much more than beating a
            700 word.
          </p>
        ),
      },
      {
        q: "What's my streak?",
        plain: `${TERMS.streak.simple} ${TERMS.streak.detail} Miss a day and it resets to zero; your all-time best streak is saved separately.`,
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            <Hint term="streak" />: {TERMS.streak.simple.charAt(0).toLowerCase() + TERMS.streak.simple.slice(1)} Miss a
            day — even by a few minutes past midnight in your local time — and it resets to zero. Your all-time best
            streak is saved separately and never resets. {TERMS.streak.detail} The Daily refreshes at midnight in your
            local time zone.
          </p>
        ),
      },
    ],
  },
  /* ============================== 4. THE BOT'S PICKS ============================== */
  {
    slug: 'bot',
    title: "The engine's picks",
    icon: <Brain size={16} />,
    intro: 'How the engine chooses the guesses it recommends — and why they sometimes surprise you. From here on, the sections get more technical.',
    items: [
      {
        q: "How does the bot decide its top picks?",
        plain:
          'The bot scores every valid guess by computing the expected information gain — a weighted average over all possible feedback patterns. Whichever guess is expected to narrow down the remaining possibilities the most becomes the top pick. It has no sentimental attachment to any particular word, and it does not care how unusual the suggestion looks.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The bot scores every valid guess by computing the expected information gain — a
              weighted average over all possible feedback patterns. Whichever guess is expected to
              narrow down the remaining possibilities the most becomes the top pick.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              It has no sentimental attachment to any particular word, and it does not care how
              unusual the suggestion looks. If XYLEM is the cleanest test at a certain point in the
              game, XYLEM goes to the top of the list. Words that could actually be the answer are
              given a slight tiebreaker boost — but only when they are otherwise equally efficient.
            </p>
          </div>
        ),
      },
      {
        q: "Why does the bot sometimes ignore a green square?",
        plain:
          'When very few words remain, the fastest path to the answer is often a guess that tests multiple unknowns at once — even if that means temporarily ignoring a green letter. Example: VERGE then TRACE then SHRUG. TRACE does not reuse the green E from VERGE. That seems wasteful, but TRACE tests four new high-value letters. SHRUG then covers the remaining unknowns. This is called an efficiency play.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              When several possible words remain, the fastest path to the answer is often a guess
              that tests multiple unknowns at once — even if that means temporarily ignoring a green
              letter you already locked in.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-tertiary uppercase tracking-wider">
                Example: VERGE → TRACE → SHRUG
              </p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <TileRow word="VERGE" pattern={['gray', 'yellow', 'green', 'gray', 'yellow']} />
                  <span className="font-sans text-[10px] text-text-tertiary">E locked in pos 3; R and E elsewhere</span>
                </div>
                <div className="flex items-center gap-3">
                  <TileRow word="TRACE" pattern={['gray', 'green', 'yellow', 'gray', 'green']} />
                  <span className="font-sans text-[10px] text-text-tertiary">Ignores green E — tests R, A, C</span>
                </div>
                <div className="flex items-center gap-3">
                  <TileRow word="SHRUG" pattern={['gray', 'gray', 'green', 'gray', 'gray']} />
                  <span className="font-sans text-[10px] text-text-tertiary">Covers remaining unknowns</span>
                </div>
              </div>
            </InnerCard>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              TRACE doesn&apos;t reuse the green E from VERGE. That looks wasteful — but TRACE
              tests four new high-value letters at once. By the time you get to guess four, the
              field is so narrow that the solution falls out naturally. This is called an efficiency
              play, and the bot prefers it whenever it leads to a faster expected solve.
            </p>
          </div>
        ),
      },
      {
        q: "Sometimes the bot suggests the actual solution — isn't that cheating?",
        plain:
          'Nope. Let us say the solution is SLANT. The bot is telling you that, of all the words still possible, SLANT was the cleanest test — even if the answer had been something else. If you guess SLANT and it is right, great. If it is wrong, the feedback still narrows down the field efficiently. The bot picks SLANT because of its information value, not because it peeked at the answer.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Nope. Let&apos;s say the solution is SLANT. The bot is telling you that, of all the
              words still possible at that moment, SLANT was the cleanest test — even if the answer
              had been something else. It picks SLANT because of its information value, not because
              it peeked at the answer.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              When SLANT happens to be both the optimal guess and the correct answer, that is a
              coincidence the math stumbled into. There is no crystal ball — just probability.
            </p>
          </div>
        ),
      },
      {
        q: '"Expected solutions after guess" vs "actual solutions after guess" — what is the difference?',
        plain:
          'Expected is the average number of words that would remain across all possible feedback patterns for that guess. Actual is how many words remained after you saw the specific pattern you got. When actual is much lower than expected, you got lucky feedback. When it is much higher, you were unlucky.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Expected</span> is the average
              number of words that would remain across all possible feedback patterns for that guess.
              It is computed before the game knows what pattern you will get.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Actual</span> is how many words
              remained after you saw the specific pattern the real answer produced. When actual is
              much lower than expected, you got lucky feedback. When it is much higher, you were
              unlucky — a scenario the luck score picks up.
            </p>
          </div>
        ),
      },
      {
        q: 'What does "expected steps until solution" mean?',
        plain:
          'This is the bot\'s estimate of how many more guesses the average player would need from this point in the game, given the remaining words. If it says 1.8, the bot expects most paths from here to end in under 2 moves. It is a forward-looking measure: lower is better.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            This is the bot&apos;s estimate of how many more guesses the average player would need
            from this point in the game, given the remaining words. If it says 1.8, the bot expects
            most paths from here to end in under 2 moves. It is a forward-looking measure: lower is
            better. A well-placed guess drops it by more than 1; a wasteful guess barely moves it.
          </p>
        ),
      },
    ],
  },

  /* ============================== 5. HARD MODE ============================== */
  {
    slug: 'hardmode',
    title: 'Hard mode',
    icon: <Swords size={16} />,
    intro: 'Stricter rules, different optimal strategy.',
    items: [
      {
        q: 'What is hard mode?',
        plain:
          'Hard mode requires you to use every green and yellow letter you have already found in every subsequent guess. If you get a yellow R in position 2, every future guess must include an R. This rules out the efficiency plays the bot normally loves — you cannot ignore green squares or skip yellow letters.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Hard mode requires you to use every green and yellow letter you have already found in
              every subsequent guess. If you get a yellow R in position 2, every future guess must
              include an R somewhere. If you get a green E in position 3, every future guess must
              have E in position 3.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              This rules out the efficiency plays the bot normally loves — you cannot ignore green
              squares or throw an unrelated word to test new letters. Every guess must be a
              legal candidate given everything you know.
            </p>
          </div>
        ),
      },
      {
        q: 'How does hard mode change scoring?',
        plain:
          'In hard mode, the bot re-solves the game under the same constraints you faced. It only recommends guesses that honor all known green and yellow letters. The efficiency calculations and classifications are identical — they just apply to a smaller set of valid options. A Brilliant guess in hard mode is rarer and arguably more impressive.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            In hard mode, the bot re-solves the game under the same constraints you faced. It only
            recommends guesses that honor all known green and yellow letters. The efficiency
            calculations and classifications are identical — they just apply to a smaller set of
            valid options. A <ClassBadge cls="brilliant" /> guess in hard mode is
            rarer and arguably more impressive, because the room for creative plays is narrower.
          </p>
        ),
      },
      {
        q: 'Why is CLASP the recommended hard-mode first word, not SLATE?',
        plain:
          'In normal mode, SLATE is an excellent first word — it tests five high-frequency letters with no duplicates. In hard mode, SLATE commits you to placing those letters correctly from the start. CLASP, by contrast, shares similar letter coverage but leaves you more flexibility in where yellows land. The hard-mode constraint means the choice of first word matters more, and CLASP survives those constraints slightly better on average.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              In normal mode, SLATE is an excellent first word — it tests five high-frequency letters
              with no repeats. But in hard mode, every yellow and green you earn must be carried
              forward. CLASP, which covers a similar set of common letters (C, L, A, S, P), tends
              to leave you in better shape when those letters come back yellow, because the
              hard-mode constraint gives you more valid options for where to place them next.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The difference is small, but across thousands of games, CLASP produces a slightly
              lower average solve count under hard-mode rules. Normal-mode players should stick
              with SLATE or whatever first word they prefer.
            </p>
          </div>
        ),
      },
      {
        q: 'Hard mode still allows reusing gray letters — why?',
        plain:
          'Hard mode only enforces the positive constraints: use your greens and yellows. It does not force you to exclude gray letters. That asymmetry is a deliberate design choice in Wordle itself. ELOquence flags gray-letter reuse as a soft constraint violation in the analysis, but it does not prevent you from submitting the guess.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Hard mode only enforces the positive constraints: use your greens and yellows. It does
            not force you to exclude gray letters. That asymmetry is a deliberate design choice in
            Wordle itself — ELOquence follows the same rules. Reusing a gray letter is allowed but
            flagged as a soft constraint violation in the post-game analysis, since it wastes
            information you already had.
          </p>
        ),
      },
    ],
  },

  /* ============================== 6. STRATEGY & MATH ============================== */
  {
    slug: 'strategy',
    title: 'Strategy & math',
    icon: <Zap size={16} />,
    intro: 'The concepts behind efficient guessing — no formulas required.',
    items: [
      {
        q: 'What is "efficient guessing"?',
        plain:
          'An efficient guess splits the remaining possible words into as many equal-sized groups as possible. If one guess can separate five possible answers into five groups of one, you are guaranteed to solve next turn. A bad guess leaves all five words in the same group — no new information.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Suppose you have narrowed it down to BATCH, CATCH, LATCH, MATCH, PATCH. What should
              you guess next?
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <InnerCard className="space-y-2">
                <p className="font-sans text-xs font-semibold text-text-primary">Guess BATCH</p>
                <p className="font-sans text-[10px] text-text-tertiary leading-relaxed">
                  If BATCH is right, all-green. Otherwise, B comes back gray and you still have
                  four candidates left — no new info beyond ruling out B.
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TileRow word="BATCH" pattern={['green', 'green', 'green', 'green', 'green']} />
                    <span className="font-sans text-[10px] text-text-tertiary">BATCH ✓</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TileRow word="BATCH" pattern={['gray', 'green', 'green', 'green', 'green']} />
                    <span className="font-sans text-[10px] text-text-tertiary">4 words left</span>
                  </div>
                </div>
              </InnerCard>
              <InnerCard className="space-y-2">
                <p className="font-sans text-xs font-semibold text-text-primary">Guess BLIMP</p>
                <p className="font-sans text-[10px] text-text-tertiary leading-relaxed">
                  BLIMP shares no letters with any of the five words. Every solution gives a
                  different pattern — five groups of one.
                </p>
                <div className="space-y-1">
                  {(['BATCH', 'CATCH', 'LATCH', 'MATCH', 'PATCH'] as const).map((w) => (
                    <div key={w} className="flex items-center gap-2">
                      <TileRow word="BLIMP" pattern={['gray', 'gray', 'gray', 'gray', 'gray']} />
                      <span className="font-sans text-[10px] text-text-tertiary">→ {w}</span>
                    </div>
                  ))}
                </div>
              </InnerCard>
            </div>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              BLIMP splits the five solutions into five groups of one — you are guaranteed to solve
              next turn. Guessing BATCH only resolves the game immediately if BATCH is the answer;
              otherwise you are no better off than before. That is what efficiency means.
            </p>
          </div>
        ),
      },
      {
        q: 'What is a trap and how do I escape one?',
        plain:
          'A trap happens in the endgame when several possible words share all but one letter. The classic example is the _IGHT family: LIGHT, MIGHT, NIGHT, RIGHT, SIGHT, TIGHT. You know the last four letters are IGHT. But guessing each candidate one by one gives you only a 1-in-6 chance each turn. A skilled player throws an escape word — something that tests all six possible first letters at once.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              A trap happens when several possible words differ in only one position. The
              classic example is the <span className="font-mono text-text-primary">_IGHT</span> family.
              You know four of the five letters. But guessing candidates one by one gives you a
              1-in-6 shot each turn — which could cost you the game.
            </p>
            <InnerCard className="space-y-2">
              <p className="font-sans text-[10px] text-text-tertiary uppercase tracking-wider">
                The _IGHT trap
              </p>
              <div className="space-y-1">
                {[
                  { w: 'LIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'MIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'NIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'RIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'SIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                  { w: 'TIGHT', p: ['gray', 'green', 'green', 'green', 'green'] },
                ].map(({ w, p }) => (
                  <div key={w} className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Tile letter={w[0]} color="empty" size="sm" />
                      {w.slice(1).split('').map((ch, i) => (
                        <Tile key={i} letter={ch} color="green" size="sm" />
                      ))}
                    </div>
                    <span className="font-sans text-[10px] text-text-tertiary">{w}</span>
                  </div>
                ))}
              </div>
            </InnerCard>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Random guessing gives you a 1-in-6 shot. A skilled player throws an &quot;escape
              word&quot; — something like a word that contains L, M, N, R, S, and T — that tests
              all the candidate first letters at once. One guess, six letters tested, trap escaped.
              The analysis flags when you were in a trap and shows whether you handled it optimally.
            </p>
          </div>
        ),
      },
      {
        q: 'What is a constraint violation?',
        plain:
          'A hard violation means you ignored information you definitely had — for example, reusing a gray letter or placing a yellow letter in the same position it already appeared. A soft violation means you omitted a letter you know is in the word. Soft violations are sometimes strategically correct — the escape-word play deliberately does this.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Violations come in two flavors.
            </p>
            <div className="p-4 space-y-2 bg-wash-accent">
              <p className="font-sans text-xs font-semibold" style={{ color: 'var(--red)' }}>
                Hard violation
              </p>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                You used a gray letter again, or put a yellow letter in the exact position it
                already appeared. This is never strategically correct — it throws away guaranteed
                information. Marked with a <ClassBadge cls="miss" /> badge.
              </p>
            </div>
            <InnerCard className="space-y-2">
              <p className="font-sans text-xs font-semibold text-text-secondary">Soft violation</p>
              <p className="font-sans text-xs text-text-secondary leading-relaxed">
                You omitted a letter you know is in the word. This is sometimes the right call —
                the escape-word play deliberately does it. Shown as a neutral note in the analysis,
                not a warning. The context determines whether it was smart or sloppy.
              </p>
            </InnerCard>
          </div>
        ),
      },
      {
        q: 'What is green-chasing and why is it bad?',
        plain:
          'Green-chasing means guessing words that reuse letters you have already confirmed green, instead of testing new unknown letters. It feels satisfying — you are building on what you know — but it wastes guesses. Once a letter is green, you get no new information from testing it again.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Green-chasing means guessing words that reuse letters you have already confirmed as
              green, instead of testing new unknown letters. It feels productive — you are building
              on certainty — but it wastes guesses. Once a letter is green, you already know it is
              correct. Guessing it again gives you zero new information about the remaining unknowns.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The most common trap: getting green on the last four letters and then guessing five
              words in a row that all end the same way, one per unknown first letter. That is
              pure luck-based play when an escape word could have tested all five first letters
              in a single guess.
            </p>
          </div>
        ),
      },
      {
        q: "How does the bot's math actually work?",
        plain:
          'The bot computes a weighted average of information gain across all possible feedback patterns for each candidate guess. This concept comes from information theory and was popularized for Wordle by Grant Sanderson (3Blue1Brown). The bot does this computation for every valid word in the dictionary, which is why the analysis takes a moment to run.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              For each candidate guess, the bot simulates every possible feedback pattern it could
              produce against the remaining possible words. It then computes a weighted average of
              how much each pattern narrows down the search — a concept from information theory
              called entropy reduction (or information gain). The guess that maximizes this average
              becomes the top recommendation.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              This approach was popularized for Wordle by Grant Sanderson (3Blue1Brown) in his
              excellent YouTube breakdown. If you want the mathematical details, his video is the
              clearest explanation available. ELOquence extends it with skill/luck separation,
              move classification, and per-game history tracking.
            </p>
          </div>
        ),
      },
    ],
  },

  /* ============================== 7. GAME REVIEW ============================== */
  {
    slug: 'review',
    title: 'The review page',
    icon: <Target size={16} />,
    intro: 'A walkthrough of everything on the post-game review page.',
    items: [
      {
        q: "What's on the review page?",
        plain:
          'The review page is your main post-game tool. It walks you through the game one step at a time: an overview of all your moves, then a card for each guess comparing it to the bot’s optimal pick, then a final summary with community stats and your rating change. Move between steps with the arrow keys or the on-screen arrows.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              The review is a step-by-step walkthrough rather than a dashboard. Your overall skill,
              luck and first-word stats sit at the top of the overview; from there you page through one
              step at a time.
            </p>
            <div className="grid gap-2">
              {[
                { n: '1', name: 'Overview', desc: 'Your full guess grid plus a stats table summarising every move — skill, luck, words left and info gained, row by row. Click any row to jump straight to that move.' },
                { n: '2', name: 'Per-move cards', desc: 'One card per guess: its classification, a “Comparing our guesses” table (your guess vs. the bot’s optimal pick), the bits of information gained, and how each guess split the remaining solutions into groups. Expand the optimal pick to see runner-up alternatives.' },
                { n: '3', name: 'Summary', desc: 'How unique your game was versus the community, your projected rating change (Ranked games), and links back to play or share.' },
              ].map((tab) => (
                <InnerCard key={tab.n} className="flex gap-2.5">
                  <span className="font-mono text-[10px] text-text-tertiary bg-bg-muted w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                    {tab.n}
                  </span>
                  <div>
                    <p className="font-sans text-xs font-semibold text-text-primary">{tab.name}</p>
                    <p className="font-sans text-[11px] text-text-secondary leading-relaxed">{tab.desc}</p>
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'How do I see the bot’s recommended guesses?',
        plain:
          'On each per-move card the bot’s single best pick is shown with a green check and a score of 99. Expand it to reveal up to five runner-up alternatives, each with the average number of solutions it would leave behind. These are the highest-ranked guesses by expected information gain at that point in the game.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Every per-move card names the bot&apos;s single best guess for that position, marked
              with a{' '}
              <span className="font-bold" style={{ color: 'var(--tile-correct)' }}>✓</span>{' '}
              green check and a perfect score of 99 — the guess with the highest expected
              information gain.
            </p>
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Tap the chevron next to it to expand up to five runner-up alternatives. Each shows the
              word and the average number of solutions it would be expected to leave behind (lower
              is better). If your own guess was the optimal one, it simply appears as the best pick
              — you matched the bot.
            </p>
          </div>
        ),
      },
      {
        q: 'What are the pattern groups on each card?',
        plain:
          'Each per-move card shows how your guess split the remaining solutions into groups — one group per feedback pattern it could produce — side by side with how the bot’s optimal pick would have split them. More, smaller groups mean faster solving; one big group means the guess barely narrowed things down. The card also reports the number of groups, the largest group, and the bits of information gained.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Each per-move card visualises how your guess divided the solutions that remained before
            you played it: every distinct feedback pattern becomes one group, shown as a row of
            mini-tiles sized by how many words fall into it. Your split is placed next to the
            bot&apos;s optimal split for direct comparison. The accompanying table reports the
            number of groups, the largest group, and the bits of information gained — more and
            smaller groups (more bits) means the guess narrowed the field more evenly, and
            you&apos;ll usually solve faster.
          </p>
        ),
      },
      {
        q: 'What’s on the final summary (community stats)?',
        plain:
          'The last step of the review pulls back from individual moves and compares your whole game to everyone else who solved the same word: how many players got it, how your guess count stacks up, and how unique your exact sequence of guesses was. Ranked games also show your projected rating change here.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            The final step looks at the whole game in context. It shows community stats for the
            same answer — how many people solved it and how your number of guesses compares — plus
            how unique your particular path was, since identical games share a fingerprint. For
            Ranked games, your projected rating change is shown here too. From this step you can jump
            back to play or share the game.
          </p>
        ),
      },
      {
        q: 'Are there keyboard shortcuts on the review page?',
        plain:
          'Yes. Use the left and right arrow keys to step backward and forward through the review. Home jumps to the overview, and End jumps to the final summary.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Yes. The review is a stepper, so navigation is quick from the keyboard.
            </p>
            <div className="grid gap-1.5">
              {[
                { keys: '←', action: 'Previous step' },
                { keys: '→', action: 'Next step' },
                { keys: 'Home', action: 'Jump to the overview' },
                { keys: 'End', action: 'Jump to the final summary' },
              ].map((s) => (
                <InnerCard key={s.keys} className="flex items-center justify-between py-2">
                  <span className="font-mono text-xs text-text-primary bg-bg-muted px-2 py-0.5">
                    {s.keys}
                  </span>
                  <span className="font-sans text-xs text-text-secondary">{s.action}</span>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },

  /* ============================== 8. THE COACH ============================== */
  {
    slug: 'coach',
    title: 'Coach chat',
    icon: <MessageSquare size={16} />,
    intro: 'A personal tutor that has read every line of your game.',
    items: [
      {
        q: 'What is Coach Chat?',
        plain:
          'Coach Chat is an AI assistant available on the review page. Unlike a general chatbot, it has the full context of your specific game — every guess, every pattern, every score — so it can give you advice that is actually about what you played, not generic Wordle tips.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Coach Chat is an AI assistant available on the review page. Unlike a general chatbot, it
            has the full context of your specific game — every guess, every pattern, every analysis
            result — so it can give you advice that is actually about what you played, not generic
            Wordle tips. Ask it anything about your moves and it can explain, critique, or suggest
            what you could have done differently.
          </p>
        ),
      },
      {
        q: 'What can I ask it?',
        plain:
          'Anything about your game. Why was move 3 an inaccuracy? What should I have played instead? Why did the bot prefer TRACE over CRANE here? How do I avoid this kind of trap next time? The coach uses your actual game data to answer, so the responses are specific rather than generic.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              Anything about your game. A few examples of questions that work well:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Why was move 3 an inaccuracy?',
                'What should I have played instead?',
                'How do I handle this kind of trap?',
                'Why did the bot prefer TRACE here?',
                "What patterns should I look for in the endgame?",
                'How close was my skill score to a perfect game?',
              ].map((q) => (
                <span
                  key={q}
                  className="font-mono text-[11px] uppercase tracking-[0.12em] px-2.5 py-1.5 border border-border-subtle text-text-secondary"
                >
                  {q}
                </span>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'Does the coach see my full game?',
        plain:
          'Yes. Every guess, feedback pattern, skill score, luck score, move classification, candidate list, and top picks for your specific game are provided to the coach automatically. You do not need to describe your game — it already knows.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Yes. Every guess, feedback pattern, skill score, luck score, move classification,
            candidate list, and top picks for your specific game are provided to the coach
            automatically when you open the chat. You do not need to describe your game — it
            already knows. That is what makes it genuinely useful rather than a generic tip
            generator.
          </p>
        ),
      },
      {
        q: 'Are there limits?',
        plain:
          'Each game session has a 10-message limit. This resets when you start a review for a new game. The limit exists to keep the service sustainable — 10 messages is enough for a thorough debrief of any single game.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Each game session has a 10-message limit. This resets when you start a review for a new
            game. The limit exists to keep the service sustainable — 10 messages is enough for a
            thorough debrief of any single game. If you find yourself needing more, that is a sign
            you are asking broad questions; try focusing on a specific move instead.
          </p>
        ),
      },
    ],
  },

  /* ============================== 9. WORD LISTS ============================== */
  {
    slug: 'wordlists',
    title: 'Word lists',
    icon: <FileText size={16} />,
    intro: 'Four different word lists power different parts of the game.',
    items: [
      {
        q: "How many words does ELOquence know?",
        plain:
          'ELOquence works with four distinct word lists. 15,000 valid guesses — anything you can submit. 5,500 Ranked answers — the pool used for Ranked mode. 4,500 bot suggestion words — the pool the bot draws its top-pick recommendations from. 2,309 standard daily words — the classic Wordle answer list.',
        a: (
          <div className="space-y-3">
            <p className="font-sans text-sm text-text-secondary leading-relaxed">
              ELOquence works with four distinct word lists, each serving a different purpose.
            </p>
            <div className="space-y-2">
              {[
                {
                  n: '15,000',
                  label: 'Valid guesses',
                  desc: 'Anything you can submit. The full dictionary ELOquence recognizes as a legal guess.',
                },
                {
                  n: '5,500',
                  label: 'Ranked answers',
                  desc: 'The pool used for Ranked games. Broader than the daily list — includes less common but still fair words.',
                },
                {
                  n: '4,500',
                  label: 'Bot suggestion pool',
                  desc: "Words the bot can recommend as top picks. Filtered for fairness — no obscure words that would feel like a trick.",
                },
                {
                  n: '2,309',
                  label: 'Standard daily words',
                  desc: "The classic Wordle answer list. If you played the NYT's original Wordle, you know these words. Used for Daily mode.",
                },
              ].map((w) => (
                <InnerCard key={w.n} className="flex gap-3 items-start">
                  <span
                    className="font-display font-black text-lg shrink-0 leading-none mt-0.5"
                    style={{ color: 'var(--tile-correct)' }}
                  >
                    {w.n}
                  </span>
                  <div>
                    <p className="font-sans text-xs font-semibold text-text-primary">{w.label}</p>
                    <p className="font-sans text-xs text-text-secondary leading-relaxed mt-0.5">
                      {w.desc}
                    </p>
                  </div>
                </InnerCard>
              ))}
            </div>
          </div>
        ),
      },
      {
        q: 'Can I guess a word that is not on any list?',
        plain:
          'No. ELOquence only accepts guesses from the 15,000-word valid guess dictionary. If you type a word and it does not submit, it is not in the dictionary. Proper nouns, abbreviations, and most words fewer than five letters are excluded.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            No. ELOquence only accepts guesses from the 15,000-word valid-guess dictionary. If you
            type a word and it is not accepted, it is simply not in the list. Proper nouns,
            abbreviations, and most obscure technical terms are excluded. The 15,000-word list
            covers essentially all common English five-letter words.
          </p>
        ),
      },
      {
        q: 'Are past solutions excluded from future daily puzzles?',
        plain:
          'Yes, by default the bot and top-picks list exclude words that have already been the daily solution. You can toggle this behavior off in the analysis settings if you want to see what the bot would recommend without that filter.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Yes, by default the bot and top-picks list exclude words that have already appeared as
            the daily solution. You can toggle this off in the analysis settings if you want to see
            what the bot would recommend without the past-solutions filter — useful for
            understanding how the recommendations change when you lift that constraint.
          </p>
        ),
      },
      {
        q: 'Why does the bot sometimes suggest a word I have never heard of?',
        plain:
          'The bot optimizes for information gain, not familiarity. If an unusual word splits the remaining candidates perfectly, it goes to the top of the list. It is always drawn from the 4,500-word suggestion pool, so it is always a real word — just possibly one you did not know.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            The bot optimizes for information gain, not familiarity. If an unusual word splits the
            remaining candidates perfectly, it goes to the top of the list regardless of how common
            it is. All suggestions are drawn from the 4,500-word suggestion pool, so every
            recommendation is a real word — just possibly one that lives at the edge of everyday
            vocabulary. The bot has no sentimental attachment to common words.
          </p>
        ),
      },
    ],
  },

  /* ============================== 10. ARCHIVE & REPLAY ============================== */
  {
    slug: 'archive',
    title: 'Past dailies & replay',
    icon: <Star size={16} />,
    intro: 'Go back and play any past Daily.',
    items: [
      {
        q: 'What are Past dailies?',
        plain:
          'Past dailies is a collection of every past daily puzzle, available at /archive. You can replay any of them, get a full analysis, and use Coach Chat — exactly like a regular game. The only difference is that past dailies are unrated.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Past dailies is a collection of every past daily puzzle, available at{' '}
            <span className="font-mono text-text-primary">/archive</span>. You can replay any of
            them, get a full analysis, and use Coach Chat — exactly like a regular game. It is a
            great way to study specific words you heard about from friends, or to deliberately
            practice on words known to be tricky.
          </p>
        ),
      },
      {
        q: 'Does replaying a past daily affect my rating?',
        plain:
          'No. Past dailies are always unrated. Your rating, streak, and stats are not affected by anything that happens in the archive. Play as many as you like without risk.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            No. Past dailies are always unrated. Your rating, streak, and stats are completely
            unaffected by anything that happens in the archive. Play as many as you like without
            any risk to your rating. Think of the archive as a practice lab with a full analysis
            suite attached.
          </p>
        ),
      },
      {
        q: 'Can I replay a game I already played?',
        plain:
          'Yes, with a caveat: if you already played a daily and go back to replay it in the archive, you already know the answer. The analysis will still run correctly, but your skill score will reflect that foreknowledge. There is no way to un-know a word.',
        a: (
          <p className="font-sans text-sm text-text-secondary leading-relaxed">
            Yes, with a caveat: if you already played a daily and go back to replay it in the
            archive, you already know the answer. The analysis will run correctly, and your moves
            will be scored normally — but your skill score will inevitably reflect that
            foreknowledge. There is no way to un-know a word. Use the archive mainly to replay
            puzzles you missed or to study specific words cold.
          </p>
        ),
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  SectionHeader component                                             */
