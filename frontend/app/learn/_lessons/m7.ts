import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

export const MODULE_7: Module = {
  id: 'm7',
  title: 'The numbers behind the review',
  blurb: 'Words left, bits, Skill and Luck: what the review page is measuring.',
  lessons: [
    {
      id: 'm7l1',
      moduleId: 'm7',
      title: 'What the review is telling you',
      subtitle: 'Every guess is scored by how much of the list it removed, not by whether it won.',
      challenges: [
        {
          kind: 'pool-shrink',
          prompt: 'A real three-guess solve. The 100 dots stand for all 2,309 answers; the hidden word is DEBUT.',
          startCount: 100,
          steps: [
            { label: 'SLATE: grey grey grey yellow yellow. 72 words left', remaining: 3, note: 'T and E are in the word, in other spots. 2,309 → 72 is the narrowing the review shows for guess 1.' },
            { label: 'DETER: green green yellow grey grey. 3 words left', remaining: 1, note: 'DEBIT, DEBUT or DEPOT. 72 → 3 is a strong second guess, and that narrowing is what Skill measures.' },
            { label: 'DEBUT: solved on guess 3', remaining: 1, note: 'Picking the right one of three is luck, and the review scores it as Luck, not Skill.' },
          ],
          successNote: 'Skill is the narrowing your choices earned; Luck is where the hidden word happened to land.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'SLATE leaves about 70 of the 2,309 answers on average. How much smaller is that?',
          options: [
            { label: 'About half', sub: '2,309 → 1,150' },
            { label: 'About a tenth', sub: '2,309 → 230' },
            { label: 'About a thirtieth', sub: '2,309 → 70' },
          ],
          correctIdx: 2,
          successNote: 'Each halving of the list is one bit, so 2,309 → 70 is five halvings, about 5 bits, which is the number the review shows next to a guess in Detailed view.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Two games, same word (DEBUT), both solved in three. Sort what each moment adds to.',
          buckets: [
            { id: 'skill', label: 'Skill' },
            { id: 'luck', label: 'Luck' },
          ],
          items: [
            { id: 'a', label: 'DETER cut 72 words to 3', bucketId: 'skill' },
            { id: 'b', label: 'Picked DEBUT out of 14', bucketId: 'luck' },
            { id: 'c', label: 'CLIMB sorted all 7 _ATCH words', bucketId: 'skill' },
            { id: 'd', label: 'First word landed three greens', bucketId: 'luck' },
            { id: 'e', label: 'TEETH cut 72 words to 14', bucketId: 'skill' },
          ],
          successNote: 'Skill scores each guess against the best guess available at that moment, so DETER scores high and TEETH low; which words the tiles happened to leave is Luck.',
        },
        {
          kind: 'reveal',
          title: 'You know everything the engine knows.',
          body: 'Read every row as a filter, keep one first word, test fresh letters, probe when a probe pays, spot a family early. The review in Daily and Ranked measures exactly those things. Go play.',
        },
      ],
    },
  ],
};
