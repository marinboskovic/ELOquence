import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

export const MODULE_4: Module = {
  id: 'm4',
  title: 'Gather clues or go for it',
  blurb: 'When to test letters with a word that cannot win, and when to guess an answer.',
  lessons: [
    {
      id: 'm4l1',
      moduleId: 'm4',
      title: 'The probe',
      subtitle: 'A probe is a word you know is not the answer, played to test letters.',
      challenges: [
        {
          kind: 'reveal',
          title: 'A word that cannot win, played on purpose',
          body: 'CRANE came back with a yellow A and a yellow N, so the answer has both. MOIST has neither, so it cannot be the answer. It is played anyway: M, O, I, S and T are five letters the 47 remaining words differ on. That is a probe.',
          guess: 'MOIST',
          target: 'the 47 words left',
          pattern: P('_____'),
        },
        {
          kind: 'multiple-choice',
          prompt: 'CRANE came back with a yellow A and a yellow N. 47 words are left, it is guess 2. Which word?',
          options: [
            { label: 'HUMAN', word: 'HUMAN', sub: 'Fits the clues, so it could win now, 1 time in 47' },
            { label: 'MOIST', word: 'MOIST', sub: 'Cannot be the answer: no A, no N' },
          ],
          correctIdx: 1,
          successNote: 'MOIST leaves about 3 of the 47 on average and HUMAN about 8, because HUMAN spends two tiles on A and N, which you already know are in the word.',
        },
        {
          kind: 'pool-shrink',
          prompt: 'The same game, played out. The hidden word is BATON.',
          startCount: 47,
          steps: [
            { label: 'MOIST: grey yellow grey grey yellow. 3 words left', remaining: 3, note: 'O and T are in the word, M, I and S are not: BATON, TALON or TANGO. (HUMAN would have left 8 on average.)' },
            { label: 'BATON: solved on guess 4', remaining: 1, note: 'One in three on guess 3 would have been luck; a probe made guess 4 certain.' },
          ],
          successNote: 'A probe trades the small chance of winning now for a much smaller list next turn.',
        },
      ],
    },
    {
      id: 'm4l2',
      moduleId: 'm4',
      title: 'Split what is left',
      subtitle: 'When the remaining words differ by one letter, pick a word that tells them apart.',
      challenges: [
        {
          kind: 'multiple-choice',
          prompt: 'Only BATCH and CATCH are left. Which word tells them apart?',
          options: [
            { label: 'BLIMP', word: 'BLIMP', sub: 'B in spot 1' },
            { label: 'OCEAN', word: 'OCEAN', sub: 'Has a C' },
            { label: 'MIGHT', word: 'MIGHT', sub: 'Shares no useful letter' },
          ],
          correctIdx: 0,
          successNote: 'BLIMP\'s B goes green for BATCH and grey for CATCH, while OCEAN\'s C is yellow either way, because both words have a C in spot 4. (With just two left and guesses to spare, playing BATCH itself is as good: you win now half the time.)',
        },
        {
          kind: 'word-survivors',
          prompt: 'BATCH, CATCH, HATCH and LATCH are all still possible. Tap every word that would tell all four apart.',
          constraints: ['Each of the four must get a different pattern', 'C and H are in every one of them'],
          candidates: [
            { word: 'CLIMB', survives: true },
            { word: 'BLIMP', survives: false },
            { word: 'CABLE', survives: true },
            { word: 'BLOCK', survives: false },
            { word: 'CHALK', survives: false },
            { word: 'CABAL', survives: true },
            { word: 'TABLE', survives: false },
            { word: 'OCEAN', survives: false },
            { word: 'MIGHT', survives: false },
          ],
          successNote: 'Only a C in spot 1 separates CATCH from HATCH, so a splitter needs C first plus B and L somewhere; BLIMP sorts BATCH and LATCH but leaves CATCH and HATCH looking the same.',
        },
        {
          kind: 'guess-next',
          prompt: 'Guess 3 of 6. BATCH, CATCH, HATCH and LATCH are left. Which word?',
          history: [
            { guess: 'TRACE', pattern: P('Y.YG.') },
            { guess: 'SWAMP', pattern: P('..Y..') },
          ],
          options: [
            { word: 'CLIMB', revealPattern: P('YY...'), sub: 'Sorts all four' },
            { word: 'BLIMP', sub: 'Sorts BATCH and LATCH, not CATCH from HATCH' },
            { word: 'BATCH', sub: 'Right 1 time in 4, learns nothing otherwise' },
          ],
          correctIdx: 0,
          successNote: 'After CLIMB you know the answer for guess 4 whatever happens, while guessing members one by one can take until guess 6.',
        },
      ],
    },
    {
      id: 'm4l3',
      moduleId: 'm4',
      title: 'The last guess',
      subtitle: 'A probe only pays if you have a guess left to use what it finds.',
      challenges: [
        {
          kind: 'multiple-choice',
          prompt: 'Guess 6, the last one. HASTE, PASTE and TASTE are left. What do you play?',
          options: [
            { label: 'One of the three', sub: 'Right 1 time in 3' },
            { label: 'HAPPY, to find out which', sub: 'It would sort them, but there is no guess 7' },
          ],
          correctIdx: 0,
          successNote: 'On the last guess only an answer can win, so a probe is a certain loss and a 1-in-3 guess is the best you have.',
        },
        {
          kind: 'guess-next',
          prompt: 'Now it is guess 5, with two guesses left. Same three words. Which do you play?',
          history: [
            { guess: 'SLATE', pattern: P('Y.YGG') },
            { guess: 'BASTE', pattern: P('.GGGG') },
            { guess: 'CASTE', pattern: P('.GGGG') },
            { guess: 'WASTE', pattern: P('.GGGG') },
          ],
          options: [
            { word: 'HAPPY', revealPattern: P('.GY..'), sub: 'Three different patterns for the three words' },
            { word: 'HASTE', sub: 'Right 1 time in 3, then a coin flip on guess 6' },
            { word: 'PASTA', sub: 'Only tests P: HASTE and TASTE look the same' },
          ],
          correctIdx: 0,
          successNote: 'HAPPY gives a different reply for each of the three, so guess 6 is certain; guessing HASTE loses 1 game in 3.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Sort each situation: probe first, or guess an answer now?',
          buckets: [
            { id: 'probe', label: 'Probe first' },
            { id: 'guess', label: 'Guess an answer' },
          ],
          items: [
            { id: 'a', label: '40 left, 5 guesses', bucketId: 'probe' },
            { id: 'b', label: '2 left, 2 guesses', bucketId: 'guess' },
            { id: 'c', label: '3 left, 2 guesses', bucketId: 'probe' },
            { id: 'd', label: '3 left, 1 guess', bucketId: 'guess' },
            { id: 'e', label: '7 left (_ATCH), 4 guesses', bucketId: 'probe' },
            { id: 'f', label: '1 left, 3 guesses', bucketId: 'guess' },
          ],
          successNote: 'Guess an answer when it is your last guess, when one word is left, or when two are left and you can afford a miss; otherwise a probe makes the next guess certain.',
        },
      ],
    },
  ],
};
