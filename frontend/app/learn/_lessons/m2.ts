import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

/* First words that leave about 80 or fewer of the 2,309 answers on average
 * (all score 5.7 bits or more). Verified by the lesson script. */
const STRONG_FIRST_WORDS = 'SOARE ROATE RAISE SLATE SALET CRATE IRATE TRACE ARISE ORATE STARE CARTE CARET SNARE AROSE LEAST TARES ALERT CRANE STALE SANER TEARS ALTER LATER TASER RAILE REAST ARIEL TALER RATEL'.split(' ');

export const MODULE_2: Module = {
  id: 'm2',
  title: 'Your first word',
  blurb: 'Pick one strong first word and learn what its replies mean.',
  lessons: [
    {
      id: 'm2l1',
      moduleId: 'm2',
      title: 'What a good first word does',
      subtitle: 'Five different common letters, each in a spot it likes.',
      challenges: [
        {
          kind: 'multiple-choice',
          prompt: 'The hidden word is SOLAR. Which first word tells you more?',
          options: [
            { label: 'SALET', word: 'SALET', pattern: P('GYG..'), sub: 'Five different letters, three of them coloured' },
            { label: 'MAMMA', word: 'MAMMA', pattern: P('.Y...'), sub: 'Only two different letters, one coloured' },
          ],
          correctIdx: 0,
          successNote: 'Five different letters test five things at once; MAMMA spends three tiles asking about M.',
        },
        {
          kind: 'letter-picker',
          prompt: 'Build a first word with five different common letters (SLATE, CRANE, RAISE and about 30 others count).',
          absent: [],
          known: [],
          validProbes: STRONG_FIRST_WORDS,
          successNote: 'That word leaves about 60 to 80 of the 2,309 answers on average, which is as good as a first word gets.',
        },
        {
          kind: 'pool-shrink',
          prompt: 'Same 2,309 answers, two different first words. The 100 dots stand for the whole list.',
          startCount: 100,
          steps: [
            { label: 'AUDIO: about 180 words left', remaining: 8, note: 'Four vowels, but D is its only common consonant, so most rows come back mostly grey. About 8 in every 100 answers survive.' },
            { label: 'SLATE: about 70 words left', remaining: 3, note: 'S, L, A, T, E are among the most common letters, so almost every answer lights up something. About 3 in every 100 survive.' },
          ],
          successNote: 'The first word cannot win the game, but it decides how much of the list is still standing at guess 2.',
        },
      ],
    },
    {
      id: 'm2l2',
      moduleId: 'm2',
      title: 'Keep one and learn its replies',
      subtitle: 'Play the same first word every day and its patterns become familiar.',
      challenges: [
        {
          kind: 'tile-paint',
          prompt: 'You play SLATE. The hidden word is STAGE. Paint the row.',
          guess: 'SLATE',
          target: 'STAGE',
          successNote: 'S, A and E are green and T is yellow; after a reply like this only a few words are left, and with SLATE every day you start to recognise them.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'SLATE came back all grey. 221 words are left. Which second word?',
          options: [
            { label: 'CRONY', word: 'CRONY', sub: 'Five new letters, all common' },
            { label: 'MUMMY', word: 'MUMMY', sub: 'New letters, but only three different ones' },
            { label: 'STEAL', word: 'STEAL', sub: 'The same five letters you just ruled out' },
          ],
          correctIdx: 0,
          successNote: 'CRONY leaves about 7 words on average, MUMMY about 37, and STEAL tells you nothing at all, because every tile is already known grey.',
        },
        {
          kind: 'guess-next',
          prompt: 'SLATE came back with a yellow A and a green E. 31 words are left. Which second word?',
          history: [{ guess: 'SLATE', pattern: P('..Y.G') }],
          options: [
            { word: 'RANGE', revealPattern: P('YG..G'), sub: 'A moved to spot 2, E kept, three new letters' },
            { word: 'AGREE', sub: 'Could be the answer, but the second E tests nothing' },
            { word: 'ABATE', sub: 'A back in spot 3, and T is already grey' },
          ],
          correctIdx: 0,
          successNote: 'RANGE leaves about 3 of the 31 on average, AGREE about 5 and ABATE about 11; with one first word you meet this reply often enough to have RANGE ready.',
        },
      ],
    },
  ],
};
