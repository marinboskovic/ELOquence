import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

export const MODULE_6: Module = {
  id: 'm6',
  title: 'Hard mode',
  blurb: 'Every clue you find must be reused, so probes are mostly off the table.',
  lessons: [
    {
      id: 'm6l1',
      moduleId: 'm6',
      title: 'The rule',
      subtitle: 'Greens stay where they are. Yellows must appear somewhere. Greys are allowed.',
      challenges: [
        {
          kind: 'reveal',
          title: 'What hard mode forces',
          body: 'CRANE against HOUSE: the E is green. From now on every guess must have E in spot 5. A yellow letter must be used again somewhere. A grey letter is still allowed, which is the part most people get wrong.',
          guess: 'CRANE',
          target: 'HOUSE',
          pattern: P('....G'),
        },
        {
          kind: 'word-survivors',
          prompt: 'Hard mode. CRANE came back with a yellow R and a green E. Tap every word you are allowed to play next.',
          constraints: ['Must contain R', 'Must have E in spot 5'],
          candidates: [
            { word: 'BRINE', survives: true },
            { word: 'SHIRT', survives: false },
            { word: 'STORE', survives: true },
            { word: 'BLAME', survives: false },
            { word: 'PRIDE', survives: true },
            { word: 'TREES', survives: false },
            { word: 'ROUGE', survives: true },
            { word: 'GHOST', survives: false },
            { word: 'ERASE', survives: true },
          ],
          successNote: 'ERASE is legal even though A is known grey, and TREES is not, because its E\'s are in spots 3 and 4, not 5; the rule is only about greens and yellows.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'Hard mode. TARES against STORM came back like this. What must guess 2 contain?',
          options: [
            { label: 'T, R and S, each somewhere', word: 'TARES', pattern: P('Y.Y.Y'), sub: 'All three yellows must be used' },
            { label: 'Any one of T, R or S', word: 'TARES', pattern: P('Y.Y.Y'), sub: 'Not enough' },
            { label: 'T in spot 1, R in spot 3, S in spot 5', word: 'TARES', pattern: P('Y.Y.Y'), sub: 'Those are the spots they are not in' },
          ],
          correctIdx: 0,
          successNote: 'Each yellow is a letter you must play again, anywhere, so guess 2 must hold T, R and S, with only two tiles free for new letters.',
        },
      ],
    },
    {
      id: 'm6l2',
      moduleId: 'm6',
      title: 'Hard mode changes the plan',
      subtitle: 'You cannot probe freely, so pick words that are legal and still test the most.',
      challenges: [
        {
          kind: 'multiple-choice',
          prompt: 'Hard mode. Which first word is the safer choice?',
          options: [
            { label: 'SLATE', word: 'SLATE', sub: 'Its worst four-green reply leaves 2 words' },
            { label: 'LIGHT', word: 'LIGHT', sub: 'Grey then four greens leaves 8 words, and only _IGHT words are legal' },
          ],
          correctIdx: 0,
          successNote: 'With _IGHT locked, hard mode lets you test one first letter per guess, so a first word that ends in a common family can cost the game before it starts.',
        },
        {
          kind: 'guess-next',
          prompt: 'Hard mode. SLATE came back green, grey, green, grey, green: 13 words fit S_A_E. Which legal word?',
          history: [{ guess: 'SLATE', pattern: P('G.G.G') }],
          options: [
            { word: 'SHARE', revealPattern: P('G.GGG'), sub: 'H is in 6 of the 13, R in 4' },
            { word: 'SUAVE', sub: 'U is in 1 of the 13, V in 2' },
            { word: 'STATE', sub: 'Legal, but T is already grey' },
          ],
          correctIdx: 0,
          successNote: 'SHARE leaves about 4 of the 13 on average and SUAVE about 9, while STATE leaves all 13, because every tile it adds is already answered.',
        },
        {
          kind: 'sort-buckets',
          prompt: 'Hard mode. SLATE gave a yellow A and a green E; RANGE gave a yellow R and greens A and E. Sort these guesses.',
          buckets: [
            { id: 'legal', label: 'Allowed' },
            { id: 'illegal', label: 'Not allowed' },
          ],
          items: [
            { id: 'carve', label: 'CARVE', bucketId: 'legal' },
            { id: 'marsh', label: 'MARSH', bucketId: 'illegal' },
            { id: 'barge', label: 'BARGE', bucketId: 'legal' },
            { id: 'crane', label: 'CRANE', bucketId: 'illegal' },
            { id: 'raise', label: 'RAISE', bucketId: 'legal' },
            { id: 'argue', label: 'ARGUE', bucketId: 'illegal' },
            { id: 'parse', label: 'PARSE', bucketId: 'legal' },
            { id: 'waver', label: 'WAVER', bucketId: 'illegal' },
            { id: 'large', label: 'LARGE', bucketId: 'legal' },
          ],
          successNote: 'A in spot 2, E in spot 5 and an R somewhere is the whole rule: RAISE and LARGE are allowed with their grey S and L, while CRANE and ARGUE move the A and WAVER moves the E.',
        },
      ],
    },
  ],
};
