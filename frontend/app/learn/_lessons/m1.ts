import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

export const MODULE_1: Module = {
  id: 'm1',
  title: 'How the game works',
  blurb: 'Reading the board, for someone who has never played.',
  lessons: [
    {
      id: 'm1l1',
      moduleId: 'm1',
      title: 'Read the colours',
      subtitle: 'Green: right letter, right spot. Yellow: right letter, wrong spot. Grey: not in the word.',
      challenges: [
        {
          kind: 'tile-paint',
          prompt: 'You guessed CRANE. The hidden word is ARISE. Paint each tile the colour the game would show.',
          guess: 'CRANE',
          target: 'ARISE',
          successNote: 'R and E sit in the same spots in both words, so they go green; A is in ARISE but not in spot 3, so it goes yellow.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'CRANE came back grey, green, yellow, grey, green. What does the yellow A tell you?',
          options: [
            { label: 'A is in the word', sub: 'True, but that is only half of it' },
            { label: 'A is not in spot 3', sub: 'True, but that is only half of it' },
            { label: 'Both: A is in the word, and it is not in spot 3', sub: 'One tile, two facts' },
          ],
          correctIdx: 2,
          successNote: 'A yellow always says two things at once, which is why a yellow row narrows the list more than it looks.',
        },
        {
          kind: 'word-survivors',
          prompt: 'CRANE came back grey, green, yellow, grey, green. Tap every word that could still be the answer.',
          constraints: ['No C', 'R in spot 2', 'A in the word, not in spot 3', 'No N', 'E in spot 5'],
          candidates: [
            { word: 'ARISE', survives: true },
            { word: 'BRAVE', survives: false },
            { word: 'AROSE', survives: true },
            { word: 'DRIVE', survives: false },
            { word: 'GRAPE', survives: false },
            { word: 'ARGUE', survives: true },
            { word: 'PRONE', survives: false },
            { word: 'ERASE', survives: false },
          ],
          successNote: 'BRAVE, GRAPE and ERASE have A in spot 3, where the tile was yellow, not green; only ARISE, AROSE and ARGUE fit all five tiles, and those are the only three answers that do.',
        },
      ],
    },
    {
      id: 'm1l2',
      moduleId: 'm1',
      title: 'Twice the same letter',
      subtitle: 'A repeated letter in your guess only gets coloured as many times as the answer has it.',
      challenges: [
        {
          kind: 'reveal',
          title: 'One E in the answer, two in your guess',
          body: 'SPEED against PRICE: P and the first E go yellow because PRICE has them. The second E goes grey, not because E is missing, but because PRICE has only one E and the first tile already claimed it.',
          guess: 'SPEED',
          target: 'PRICE',
          pattern: P('.YY..'),
        },
        {
          kind: 'tile-paint',
          prompt: 'SPEED again, but now the hidden word is SHEEP, which has two E\'s. Paint the row.',
          guess: 'SPEED',
          target: 'SHEEP',
          successNote: 'Both E\'s colour this time (and both are green), because SHEEP has two E\'s to give.',
        },
        {
          kind: 'tile-tap',
          prompt: 'POPPY against POSED. P and O are already green. Tap a P that comes back grey.',
          guess: 'POPPY',
          target: 'POSED',
          correctIdx: [2, 3],
          correctState: 'absent',
          initialReveal: P('GG___'),
          successNote: 'POSED has one P and the green tile in spot 2 already used it, so the other two P\'s go grey even though P is in the word.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'ALLEY against the hidden word came back like this. How many L\'s does the answer have?',
          options: [
            { label: 'None', word: 'ALLEY', pattern: P('.Y.Y.'), sub: 'But one L is yellow' },
            { label: 'Exactly one', word: 'ALLEY', pattern: P('.Y.Y.'), sub: 'One L coloured, one L grey' },
            { label: 'Two or more', word: 'ALLEY', pattern: P('.Y.Y.'), sub: 'Then both L\'s would be coloured' },
          ],
          correctIdx: 1,
          successNote: 'A coloured L plus a grey L means the answer has exactly one L (here the answer was LEMON), so a grey repeat is a count, not a miss.',
        },
      ],
    },
  ],
};
