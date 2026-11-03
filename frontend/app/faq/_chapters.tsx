'use client';
/**
 * The short tour: six chapters, three to five slides each, one idea per slide.
 * Facts come from lib/copy.ts so Help says the same thing as the rest of the app;
 * the jokes are ours. Everything deeper lives in _data.tsx (the nerd corner).
 */
import Tile from '@/components/Tile';
import { MiniTiles, Tag } from '@/components/ui';
import { MODES, MOVE_CLASS, TERMS, TIER_COPY } from '@/lib/copy';
import type { TileState } from '@/lib/types';

export interface Slide {
  title: string;
  /** One or two sentences. Three is a manual. */
  body: string;
  visual: React.ReactNode;
  /** The deadpan aside, set in mono under the body. Optional, never mandatory. */
  aside?: string;
}

export interface Chapter {
  slug: string;
  /** "01" … "06" — printed big on the list. */
  number: string;
  title: string;
  /** One line under the title on the chapter list. */
  blurb: string;
  /** Mini board shown on the chapter list row. */
  preview: React.ReactNode;
  slides: Slide[];
  /** Where the last slide's button goes. */
  cta: { label: string; href: string };
}

/* ───────────── small visuals ───────────── */

const T = '40px';
const C: TileState = 'correct';
const P: TileState = 'present';
const A: TileState = 'absent';
const E: TileState = 'empty';
const D: TileState = 'tbd';

function Row({ word, states, size = T }: { word: string; states: TileState[]; size?: string }) {
  return (
    <div className="flex" style={{ gap: 5 }} role="img" aria-label={word}>
      {word.split('').map((ch, i) => (
        <Tile key={`${i}-${states[i]}`} letter={ch} state={states[i]} position={i} size={size} />
      ))}
    </div>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-label uppercase text-text-secondary">{children}</span>;
}

function Num({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span className={muted ? 'font-display font-black text-2xl tabular text-text-tertiary' : 'font-display font-black text-2xl tabular text-text-primary'}>
      {children}
    </span>
  );
}

/** Shrinking list: 2,309 → 78 → 3 → 1 with bars on a log scale. */
function Shrink() {
  const steps: [string, number][] = [['start', 2309], ['SLATE', 78], ['CRONY', 3], ['CRIME', 1]];
  return (
    <div className="flex flex-col gap-2 w-full">
      {steps.map(([label, n]) => (
        <div key={label} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3">
          <Caption>{label}</Caption>
          <div className="h-2.5 bg-bg-ink" style={{ width: `${Math.max(2, (Math.log(n) / Math.log(2309)) * 100)}%` }} />
          <span className="font-mono text-sm tabular text-text-primary text-right">{n.toLocaleString('en-US')}</span>
        </div>
      ))}
    </div>
  );
}

function Verdicts() {
  const ladder = ['best', 'good', 'okay', 'mistake', 'blunder'] as const;
  const tone = (k: (typeof ladder)[number]) => (k === 'best' || k === 'good' ? 'green' : k === 'okay' ? 'neutral' : 'warn');
  return (
    <div className="flex flex-col gap-2 w-full">
      {ladder.map((k) => (
        <div key={k} className="flex items-center gap-3">
          <Tag tone={tone(k)} className="w-24 justify-center shrink-0">
            {MOVE_CLASS[k].label}
          </Tag>
          <span className="text-sm text-text-secondary">{MOVE_CLASS[k].simple}</span>
        </div>
      ))}
    </div>
  );
}

function RatingJump() {
  return (
    <div className="flex items-center gap-5">
      <div>
        <Num>1,057</Num>
        <Caption>
          <span className="block">before</span>
        </Caption>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-display font-bold text-base text-accent">+43</span>
        <span className="block w-12 h-px bg-border-default" aria-hidden="true" />
        <Caption>hard word</Caption>
      </div>
      <div>
        <Num>1,100</Num>
        <Caption>
          <span className="block">after</span>
        </Caption>
      </div>
    </div>
  );
}

function Modes() {
  return (
    <div className="flex flex-col gap-2.5 w-full">
      {(['daily', 'competitive', 'practice', 'challenge'] as const).map((k) => {
        const m = MODES[k];
        return (
          <div key={k} className="flex items-start gap-3">
            <Tag tone={m.rated ? 'ochre' : 'neutral'} className="w-20 justify-center shrink-0 mt-0.5">
              {m.name}
            </Tag>
            <span className="text-sm text-text-secondary min-w-0">{m.tagline}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tiers() {
  const tiers = [
    ['Novice', 'up to 1199', 'bg-tier-novice'],
    ['Veteran', '1200 – 1399', 'bg-tier-veteran'],
    ['Master', '1400 – 1599', 'bg-tier-master'],
    ['Grandmaster', '1600+', 'bg-tier-grandmaster'],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 w-full">
      {tiers.map(([name, range, cls]) => (
        <div key={name} className="flex items-start gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${cls}`} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              {name} <span className="font-mono text-label text-text-secondary ml-1">{range}</span>
            </p>
            <p className="text-xs text-text-secondary">{TIER_COPY[name].simple}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Chat() {
  return (
    <div className="flex flex-col gap-2 w-full max-w-sm">
      <p className="self-end bg-bg-ink text-text-on-ink text-sm px-3 py-2">Why was guess 2 a big miss?</p>
      <p className="self-start border border-border-default text-sm px-3 py-2 text-text-primary">
        You already knew the E was last. EXULT put it first. SLIME keeps every clue and leaves 4 words.
      </p>
    </div>
  );
}

function HardModeRule() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Row word="CRANE" states={[C, A, P, A, A]} size="32px" />
        <Caption>C stays · A comes back</Caption>
      </div>
      <div className="flex items-center gap-3">
        <Row word="CLASP" states={[C, D, D, D, D]} size="32px" />
        <Tag tone="green">allowed</Tag>
      </div>
      <div className="flex items-center gap-3">
        <Row word="SLATE" states={[D, D, D, D, D]} size="32px" />
        <Tag tone="warn">not allowed</Tag>
      </div>
    </div>
  );
}

/* ───────────── chapters ───────────── */

export const CHAPTERS: Chapter[] = [
  {
    slug: 'play',
    number: '01',
    title: 'How to play',
    blurb: 'Six tries, five letters, three colours. You already know this one.',
    preview: <MiniTiles word="CRANE" states={[A, P, A, A, C]} size={18} gap={2} />,
    cta: { label: "Play today's word", href: '/play' },
    slides: [
      {
        title: 'Guess the word',
        body: 'Find the hidden five-letter word in six tries. Any real word counts as a guess.',
        visual: <Row word="GUESS" states={[D, D, D, D, D]} />,
        aside: 'Yes, even ADIEU. We will talk about that.',
      },
      {
        title: 'Read the colours',
        body: 'After each guess the tiles tell you how close you were.',
        visual: (
          <div className="flex flex-col gap-3 w-full">
            {([
              ['R', C, 'Right letter, right spot.'],
              ['O', P, 'In the word, wrong spot.'],
              ['T', A, 'Not in the word.'],
            ] as [string, TileState, string][]).map(([ch, state, label]) => (
              <div key={ch} className="flex items-center gap-3">
                <Tile letter={ch} state={state} size={T} />
                <span className="text-sm text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
        ),
        aside: 'Grey is not a punishment. Grey is information.',
      },
      {
        title: 'Use what you learned',
        body: 'Keep the greens where they are, move the yellows, drop the greys. Most games are won by people who do only this.',
        visual: (
          <div className="flex flex-col gap-2">
            <Row word="SALET" states={[A, P, A, P, A]} size="32px" />
            <Row word="CRANE" states={[C, C, C, C, C]} size="32px" />
          </div>
        ),
      },
      {
        title: 'Then you get a review',
        body: 'When the game ends, every guess gets a verdict. Next to the costly ones you see the word you could have played.',
        visual: (
          <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center gap-3 flex-wrap">
              <Row word="FUZZY" states={[A, A, A, A, A]} size="32px" />
              <Tag tone="warn">{MOVE_CLASS.mistake.label}</Tag>
            </div>
            <p className="text-sm text-text-secondary flex items-center gap-2 flex-wrap">
              <span>a better word was</span>
              <MiniTiles word="SLATE" states={[E, E, E, E, E]} size={20} />
            </p>
          </div>
        ),
        aside: 'The review is where you get better. The game is where you find out.',
      },
    ],
  },
  {
    slug: 'first-word',
    number: '02',
    title: 'Your first word',
    blurb: 'The only guess you make with zero clues. Make it count.',
    preview: <MiniTiles word="SLATE" states={[E, E, E, E, E]} size={18} gap={2} />,
    cta: { label: 'Try yours in the Word Lab', href: '/lab' },
    slides: [
      {
        title: 'It is a question, not a guess',
        body: `${TERMS.opener.simple} Common letters, each in a spot it likes, no repeats.`,
        visual: <Row word="SLATE" states={[D, D, D, D, D]} />,
      },
      {
        title: 'The good ones',
        body: 'Any of these cuts the 2,309 possible answers to about 70 on average. The engine has favourites; these are close enough.',
        visual: (
          <div className="flex flex-col gap-2 w-full">
            {([
              ['SLATE', 71],
              ['CRANE', 79],
              ['TRACE', 74],
            ] as [string, number][]).map(([w, left]) => (
              <div key={w} className="flex items-center gap-3">
                <MiniTiles word={w} states={[E, E, E, E, E]} size={24} gap={3} />
                <span className="text-sm text-text-secondary">
                  leaves <span className="font-mono text-text-primary">{left}</span> of 2,309
                </span>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: 'The famous one',
        body: 'ADIEU checks four vowels and learns almost nothing about where they go. It leaves 123 words. SLATE leaves 71.',
        visual: (
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3">
              <MiniTiles word="ADIEU" states={[E, E, E, E, E]} size={24} gap={3} />
              <span className="text-sm text-text-secondary">
                leaves <span className="font-mono text-text-primary">123</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MiniTiles word="PIZZA" states={[E, E, E, E, E]} size={24} gap={3} />
              <span className="text-sm text-text-secondary">
                leaves <span className="font-mono text-text-primary">453</span>
              </span>
            </div>
          </div>
        ),
        aside: 'ADIEU is a choice. Not a good one. PIZZA is dinner.',
      },
      {
        title: 'Pick one and keep it',
        body: 'Play the same first word every day and you learn what its colours mean. That is worth more than a slightly better word.',
        visual: <Row word="CRANE" states={[A, A, P, A, C]} />,
        aside: 'Switching openers daily is called research. It is not research.',
      },
    ],
  },
  {
    slug: 'scores',
    number: '03',
    title: 'What the numbers mean',
    blurb: 'Skill, luck, words left. Three numbers, one game, no maths degree.',
    preview: (
      <span className="font-display font-black text-xl tabular text-text-primary">
        51 <span className="text-text-tertiary">·</span> 59
      </span>
    ),
    cta: { label: 'See a review', href: '/dashboard' },
    slides: [
      {
        title: 'Skill',
        body: `${TERMS.skill.simple} Make the best guess every time and you get 100.`,
        visual: (
          <div className="flex items-end gap-6">
            <div>
              <Num>100</Num>
              <Caption>
                <span className="block">best guess every time</span>
              </Caption>
            </div>
            <div>
              <Num muted>70</Num>
              <Caption>
                <span className="block">one bad guess in a short game</span>
              </Caption>
            </div>
          </div>
        ),
        aside: 'The first word is not counted. Everyone is guessing there.',
      },
      {
        title: 'Luck',
        body: `${TERMS.luck.simple} Same guess, different day, very different tiles.`,
        visual: (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Row word="CRANE" states={[A, A, A, A, A]} size="32px" />
              <Caption>unlucky</Caption>
            </div>
            <div className="flex items-center gap-3">
              <Row word="CRANE" states={[C, C, C, A, C]} size="32px" />
              <Caption>lucky</Caption>
            </div>
          </div>
        ),
        aside: 'Four greens from CRANE is luck. The review will say so. Gently.',
      },
      {
        title: 'Words left',
        body: `${TERMS.wordsLeft.simple} Every guess should shrink it. Get it to one and the next guess is the word.`,
        visual: <Shrink />,
      },
      {
        title: 'The verdicts',
        body: 'Each guess is compared with the best guess available at that moment. That is the whole scale.',
        visual: <Verdicts />,
        aside: `${MOVE_CLASS.brilliant.label} exists too. You will not see it often. Neither do we.`,
      },
    ],
  },
  {
    slug: 'modes',
    number: '04',
    title: 'Modes and rating',
    blurb: 'Four ways to play. Only one of them keeps score.',
    preview: <Tag tone="ochre">rated</Tag>,
    cta: { label: 'Pick a board', href: '/play' },
    slides: [
      {
        title: 'Four ways to play',
        body: `Only ${MODES.competitive.name} touches your rating. The other three are free of consequences.`,
        visual: <Modes />,
      },
      {
        title: 'Your rating',
        body: `${TERMS.rating.simple} Beat a hard word and it goes up; miss an easy one and it goes down.`,
        visual: <RatingJump />,
        aside: `${TERMS.placement.simple} They move fast. Do not panic.`,
      },
      {
        title: 'Tiers',
        body: 'Names for rating bands. Your rating is the real number; the tier is the hat it wears.',
        visual: <Tiers />,
      },
      {
        title: 'Streak',
        body: `${TERMS.streak.simple} Miss a day and it resets to zero. Your best streak is kept forever.`,
        visual: (
          <div className="flex items-end gap-6">
            <div>
              <Num>16</Num>
              <Caption>
                <span className="block">days in a row</span>
              </Caption>
            </div>
            <div>
              <Num muted>0</Num>
              <Caption>
                <span className="block">after one missed day</span>
              </Caption>
            </div>
          </div>
        ),
        aside: 'Replaying old dailies does not count. Nice try.',
      },
    ],
  },
  {
    slug: 'review',
    number: '05',
    title: 'The review and the coach',
    blurb: 'Every game gets a verdict per guess, and someone to argue with.',
    preview: <Tag tone="green">{MOVE_CLASS.best.label}</Tag>,
    cta: { label: 'Open your last review', href: '/dashboard' },
    slides: [
      {
        title: 'Every guess, graded',
        body: 'Tap a guess to see what the engine would have played instead, and how many words each option leaves.',
        visual: (
          <div className="flex flex-col gap-2">
            {([
              ['SLATE', [A, P, A, A, C], 'best'],
              ['EXULT', [A, A, A, P, A], 'blunder'],
              ['CRIME', [C, C, C, C, C], 'best'],
            ] as [string, TileState[], 'best' | 'blunder'][]).map(([w, s, k]) => (
              <div key={w} className="flex items-center gap-3">
                <Row word={w} states={s} size="28px" />
                <Tag tone={k === 'best' ? 'green' : 'warn'}>{MOVE_CLASS[k].label}</Tag>
              </div>
            ))}
          </div>
        ),
      },
      {
        title: 'Simple or Detailed',
        body: 'Simple says "2,309 → 78 words". Detailed says "4.9 bits". Same fact, different outfit. The switch is on every page.',
        visual: (
          <div className="flex items-center gap-4 flex-wrap">
            <span className="inline-flex border border-border-default font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className="px-3 h-7 inline-flex items-center bg-bg-ink text-text-on-ink">simple</span>
              <span className="px-3 h-7 inline-flex items-center text-text-secondary">detailed</span>
            </span>
            <span className="font-mono text-sm text-text-primary">2,309 → 78 words</span>
          </div>
        ),
        aside: 'Detailed is for the thesis. Simple is for winning.',
      },
      {
        title: 'Ask the coach',
        body: 'The coach has read your game. Ask why a guess was costly, or what to open with next time.',
        visual: <Chat />,
        aside: "It will not do the Daily for you. We asked.",
      },
    ],
  },
  {
    slug: 'hardmode',
    number: '06',
    title: 'Hard mode',
    blurb: `${TERMS.hardMode.simple} Harder. More honest.`,
    preview: <MiniTiles word="CLASP" states={[C, E, E, E, E]} size={18} gap={2} />,
    cta: { label: 'Turn it on in Settings', href: '/settings' },
    slides: [
      {
        title: 'The one rule',
        body: `${TERMS.hardMode.detail}`,
        visual: <HardModeRule />,
      },
      {
        title: 'Why bother',
        body: 'It stops the throw-away "probing" word that checks five new letters and ignores every clue. You play the position you are in.',
        visual: (
          <div className="flex items-center gap-3">
            <Row word="PROBE" states={[D, D, D, D, D]} size="32px" />
            <Tag tone="warn">not here</Tag>
          </div>
        ),
        aside: 'Your rating gets no bonus for hard mode. Your pride does.',
      },
      {
        title: 'Greys are still legal',
        body: 'Hard mode only protects greens and yellows. You may reuse a grey letter. You may also eat soup with a fork.',
        visual: (
          <div className="flex items-center gap-3">
            <Row word="GRAVY" states={[A, A, A, A, A]} size="32px" />
            <Tag tone="neutral">legal, not smart</Tag>
          </div>
        ),
      },
    ],
  },
];
