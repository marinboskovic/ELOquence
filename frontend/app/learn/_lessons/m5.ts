import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

export const MODULE_5: Module = {
  id: 'm5',
  title: 'Traps',
  blurb: 'Word families that look nearly solved and are not.',
  lessons: [
    {
      id: 'm5l1',
      moduleId: 'm5',
      title: 'The _ATCH family',
      subtitle: 'Four greens, seven words. Guessing them one at a time can lose the game.',
      challenges: [
        {
          kind: 'sort-buckets',
          prompt: 'You have green A, T, C, H in spots 2 to 5. Sort these words.',
          buckets: [
            { id: 'fits', label: 'Could be the answer' },
            { id: 'no', label: 'Ruled out' },
          ],
          items: [
            { id: 'batch', label: 'BATCH', bucketId: 'fits' },
            { id: 'march', label: 'MARCH', bucketId: 'no' },
            { id: 'catch', label: 'CATCH', bucketId: 'fits' },
            { id: 'hatch', label: 'HATCH', bucketId: 'fits' },
            { id: 'teach', label: 'TEACH', bucketId: 'no' },
            { id: 'latch', label: 'LATCH', bucketId: 'fits' },
            { id: 'match', label: 'MATCH', bucketId: 'fits' },
            { id: 'bathe', label: 'BATHE', bucketId: 'no' },
            { id: 'patch', label: 'PATCH', bucketId: 'fits' },
            { id: 'watch', label: 'WATCH', bucketId: 'fits' },
          ],
          successNote: 'Seven answers end in ATCH, so four greens here still leave a 1-in-7 guess.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'You have _ATCH and it is guess 3. Which word sorts the seven best?',
          options: [
            { label: 'CLIMB', word: 'CLIMB', sub: 'C in spot 1, plus L, M, B: five different replies, 3 words left at worst' },
            { label: 'BUMPY', word: 'BUMPY', sub: 'B, M, P: four different replies, 4 left at worst' },
            { label: 'CHALK', word: 'CHALK', sub: 'C and H are yellow for every member; only L works: 5 left at worst' },
            { label: 'WATCH', word: 'WATCH', sub: 'Right 1 time in 7, 6 left otherwise' },
          ],
          correctIdx: 0,
          successNote: 'Every member has a C in spot 4 and an H in spot 5, so a C or H in your word is only useful in spot 1; CLIMB puts C there and tests L, M and B as well.',
        },
        {
          kind: 'pool-shrink',
          prompt: 'The worst case for CLIMB, played out. The hidden word is WATCH.',
          startCount: 7,
          steps: [
            { label: 'CLIMB: yellow C, four greys. 3 words left', remaining: 3, note: 'The C is yellow for every member (it sits in spot 4), so it says nothing new; grey L, M and B rule out LATCH, MATCH, BATCH, and a grey C in spot 1 rules out CATCH. HATCH, PATCH or WATCH remain.' },
            { label: 'POWER: grey grey yellow grey grey. 1 word left', remaining: 1, note: 'P green would mean PATCH, all grey HATCH; a yellow W means WATCH.' },
          ],
          successNote: 'Two probes turn a 1-in-7 family into a certain guess 5, where guessing members one at a time could run out of rows.',
        },
      ],
    },
    {
      id: 'm5l2',
      moduleId: 'm5',
      title: 'Spot a trap early',
      subtitle: 'Four greens on a common ending is a family, not a near miss.',
      challenges: [
        {
          kind: 'word-survivors',
          prompt: 'LIGHT came back grey, green, green, green, green. Tap every word that could still be the answer.',
          constraints: ['No L', 'I, G, H, T in spots 2 to 5'],
          candidates: [
            { word: 'EIGHT', survives: true },
            { word: 'FIGHT', survives: true },
            { word: 'THIGH', survives: false },
            { word: 'MIGHT', survives: true },
            { word: 'NIGHT', survives: true },
            { word: 'LIGHT', survives: false },
            { word: 'RIGHT', survives: true },
            { word: 'SIGHT', survives: true },
            { word: 'GHOST', survives: false },
            { word: 'TIGHT', survives: true },
            { word: 'WIGHT', survives: true },
          ],
          successNote: 'Eight answers still fit, so this board is further from solved than one with a single yellow R in it.',
        },
        {
          kind: 'guess-next',
          prompt: 'SOUND came back grey, green, green, green, green. Seven words are left. Which word for guess 2?',
          history: [{ guess: 'SOUND', pattern: P('.GGGG') }],
          options: [
            { word: 'MORPH', revealPattern: P('.G..Y'), sub: 'Tests M, R, P and H at once' },
            { word: 'BROWN', sub: 'Tests B, R and W' },
            { word: 'POUND', sub: 'One member: right 1 time in 7' },
          ],
          correctIdx: 0,
          successNote: 'MORPH sorts the seven into five replies with 3 left at worst, BROWN into four with 4 left, and POUND tells you nothing unless it wins.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Three boards, four greens each. Which one is the trap?',
          options: [
            { label: 'LIGHT', word: 'LIGHT', pattern: P('.GGGG'), sub: '8 words still fit' },
            { label: 'TRACE', word: 'TRACE', pattern: P('GGGG.'), sub: '2 words still fit: TRACK, TRACT' },
            { label: 'CRANE', word: 'CRANE', pattern: P('GGGG.'), sub: '1 word still fits: CRANK' },
          ],
          correctIdx: 0,
          successNote: 'Greens at the start of a word pin it down; greens on a common ending (IGHT, OUND, ATCH, ILLY) leave the first letter open and a whole family standing.',
        },
      ],
    },
  ],
};
