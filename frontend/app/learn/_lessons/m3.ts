import type { Module } from '../_components/challenges/types';
import { P } from './pattern';

/* Every real five-letter word with five different letters and none of S, T, A, R, E.
 * Generated from the game's guess list; verified by the lesson script. */
const FRESH_AFTER_STARE = 'BIDON BIGLY BIJOU BILGY BINGO BINGY BIPOD BLIMP BLIMY BLIND BLING BLINK BLINY BLOCK BLOND BLOWN BLOWY BLUDY BLUID BLUNK BODHI BOING BOINK BOLIX BOUGH BOUND BOVID BUCKO BUILD BULGY BULKY BUMPH BUMPY BUNCH BUNCO BUNDH BUNDY BUNGY BUNJY BUNKO BUXOM CHILD CHIMB CHIMO CHIMP CHING CHINO CHIVY CHOIL CHOKY CHOLI CHOMP CHOUX CHOWK CHUMP CHUNK CHYND CIBOL CLIMB CLING CLINK CLOMB CLOMP CLONK CLOUD CLOWN CLUMP CLUNG CLUNK COIGN COLBY COLIN COMBI COMBY COMFY COMIX CONKY COQUI COUGH COULD COVIN COXIB COYPU CUING CUMIN CUNDY CUPID CYLIX CYMOL DHOBI DICKY DIMBO DIMLY DINGO DINGY DINKY DOILY DOING DOLCI DOMIC DOUGH DOWLY DOWNY DUCHY DUCKY DUING DUMBO DUMKY DUMPY DUNCH DUNGY DUOMI DUPLY DYING DYKON FICHU FILCH FILMY FILUM FINCH FLICK FLIMP FLING FLOCK FLONG FLOWN FLUID FLUKY FLUMP FLUNG FLUNK FOLIC FOLKY FONDU FONLY FOUND FUDGY FUGIO FUGLY FUNDI FUNDY FUNGI FUNGO FUNKY FUZIL GHOUL GILPY GIMPY GINCH GINZO GIPON GIZMO GLOBI GLOBY GLUON GLYPH GODLY GOLDY GONCH GONIF GOPIK GOUCH GOYIM GUCKY GUILD GUIMP GULCH GULFY GULPH GULPY GUMBO GUNDY GUNKY GUQIN HILUM HIMBO HINKY HIPLY HOICK HOING HOKUM HONGI HONKY HOUND HOWDY HULKY HUMIC HUMID HUMPY HUNKY HYING HYLIC HYOID IMPLY INBOX INCOG INDOL INDOW JIMPY JINGO JOCKY JOWLY JUDGY JUICY JUMBO JUMBY JUMPY JUNCO JUNKY JUPON KHOUM KIMBO KINDY KLONG KOMBU KONBU KULFI KYLIN KYLIX LIMBO LIMBY LINCH LINDY LINGO LINGY LINKY LINUM LINUX LOCUM LOGIC LOGIN LOUGH LOUND LOWND LUCID LUCKY LUDIC LUMBI LUMPY LUNCH LUNGI LUPIN LYING LYMPH LYNCH MICKY MIDGY MILCH MILKO MILKY MINCY MINGY MIXUP MOCHI MOCHY MOGUL MOLDY MONIC MOUCH MOULD MOUND MUCHO MUCID MUCIN MUCKY MUHLY MUJIK MULCH MUNCH MUNGO MYOID NICOL NOBLY NOILY NOMIC NOULD NOVUM NUDZH NYMPH OCULI ODIUM OGMIC OHING OHMIC ONIUM OPING OPIUM OUNDY OWING OXLIP PHLOX PHONY PICKY PICUL PIGMY PIKUL PILCH PILOW PILUM PINCH PINGO PINKO PINKY PIONY PLING PLINK PLONG PLONK PLOUK PLUCK PLUMB PLUMY PLUNK POCKY PODGY POILU POIND PONCY PONGY PONZU POUCH POUND POWIN POWND POWNY PUBCO PUBIC PUDGY PUDIC PUGIL PULIK PULMO PUNCH PUNJI PUNKY PYLON PYOID QUICH QUICK QUINO QUIPO QUOIF QUOIN QUONK ULMIN UNBID UNBOX UNCOY UNFIX UNGOD UNHIP UNIFY UNKID UNLID UNMIX UNZIP UPBOW VICHY VINYL VIOLD VODUN VOUCH VOZHD VUGHY VULGO VYING WHILK WHINY WHOMP WHUMP WICKY WILCO WIMPY WINCH WINDY WINGY WOFUL WOMBY WOMYN WONGI WONKY WOULD WOUND XYLIC YCOND YOGIC YOGIN YOICK YOKUL YONIC YOUNG YUCKO YUPON ZILCH ZINCO ZINCY ZINGY ZINKY ZOMBI ZYGON ZYMIC'.split(' ');

export const MODULE_3: Module = {
  id: 'm3',
  title: 'Reading the board as a filter',
  blurb: 'Every row rules words out. The skill is knowing how many are left and testing the rest.',
  lessons: [
    {
      id: 'm3l1',
      moduleId: 'm3',
      title: 'Every row is a filter',
      subtitle: 'One row can take 2,309 words down to 100. The next can take 100 down to 1.',
      challenges: [
        {
          kind: 'word-survivors',
          prompt: 'STARE came back with only a yellow R in spot 4. Tap every word that could still be the answer.',
          constraints: ['No S, T, A or E', 'R in the word, not in spot 4'],
          candidates: [
            { word: 'CRUMB', survives: true },
            { word: 'BLURB', survives: false },
            { word: 'BRINK', survives: true },
            { word: 'TIGER', survives: false },
            { word: 'PROUD', survives: true },
            { word: 'CLOUD', survives: false },
            { word: 'CROWN', survives: true },
            { word: 'GRAPE', survives: false },
            { word: 'HUMOR', survives: true },
            { word: 'FIRST', survives: false },
          ],
          successNote: 'BLURB has R in spot 4, where the tile was yellow, and CLOUD has no R at all; the rest fail on S, T, A or E.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'STARE came back with only that yellow R. How many of the 2,309 answers could still be the word?',
          options: [
            { label: 'About 10', sub: 'Too few: four greys and one yellow do not pin much down' },
            { label: 'About 100', sub: 'Any word with an R, not in spot 4, without S, T, A or E' },
            { label: 'About 1,000', sub: 'Too many: ruling out S, T, A and E removes most of the list' },
          ],
          correctIdx: 1,
          successNote: 'Exactly 100 answers fit that row, so one mostly grey row still removed 95 of every 100 words.',
        },
        {
          kind: 'pool-shrink',
          prompt: 'The same game, played out. The 100 dots stand for all 2,309 answers.',
          startCount: 100,
          steps: [
            { label: 'STARE: grey grey grey yellow grey. 100 words left', remaining: 4, note: 'CRUMB, BRINK, PROUD, CROWN, HUMOR and 95 more.' },
            { label: 'CLOUD: grey grey green green green. 1 word left', remaining: 1, note: 'O, U, D in spots 3 to 5 with an R somewhere and no S, T, A, E, C, L: only PROUD fits.' },
          ],
          successNote: 'Two rows, 2,309 words down to one, and neither row was a lucky guess at the answer.',
        },
      ],
    },
    {
      id: 'm3l2',
      moduleId: 'm3',
      title: 'Fresh letters first',
      subtitle: 'When a row comes back mostly grey, test five letters you have not tried.',
      challenges: [
        {
          kind: 'letter-picker',
          prompt: 'STARE came back with only a yellow R. Build a second word from five letters you have not tried yet.',
          absent: ['S', 'T', 'A', 'E'],
          known: ['R'],
          validProbes: FRESH_AFTER_STARE,
          successNote: 'Five untried letters ask five new questions of the 100 words left; the R can wait, you already know it is there.',
        },
        {
          kind: 'guess-next',
          prompt: 'Same board, 100 words left. Which second word?',
          history: [{ guess: 'STARE', pattern: P('...Y.') }],
          options: [
            { word: 'CLOUD', revealPattern: P('..GGG'), sub: 'Five letters you have not tried' },
            { word: 'BRINK', sub: 'Could be the answer, but only four new letters' },
            { word: 'GRAPE', sub: 'A and E are already grey' },
          ],
          correctIdx: 0,
          successNote: 'CLOUD leaves about 5 of the 100 on average, BRINK about 9 and GRAPE about 24, because two of its tiles ask questions you have already answered.',
        },
        {
          kind: 'tile-paint',
          prompt: 'You play CLOUD. The hidden word is PROUD. Paint the row.',
          guess: 'CLOUD',
          target: 'PROUD',
          successNote: 'O, U and D land green, and with the R still to place only PROUD fits; guess 3 is the answer.',
        },
      ],
    },
    {
      id: 'm3l3',
      moduleId: 'm3',
      title: 'Where a letter sits',
      subtitle: 'A green pins a letter to one spot. A yellow leaves it three or four.',
      challenges: [
        {
          kind: 'tile-paint',
          prompt: 'You play STEAL. The hidden word is SLATE, the same five letters. Paint the row.',
          guess: 'STEAL',
          target: 'SLATE',
          successNote: 'All five letters are in the word, but only S is in its spot; four yellows tell you which letters, not where.',
        },
        {
          kind: 'multiple-choice',
          prompt: 'SLATE and STEAL use the same five letters. Which is the better first word?',
          options: [
            { label: 'SLATE', word: 'SLATE', sub: 'A in spot 3 and E in spot 5, where they most often sit' },
            { label: 'STEAL', word: 'STEAL', sub: 'T in spot 2 and E in spot 3, where they rarely sit' },
          ],
          correctIdx: 0,
          successNote: 'SLATE leaves about 70 words on average and STEAL about 90, because 422 answers end in E and 306 have A in spot 3, while only 77 have T in spot 2.',
        },
        {
          kind: 'guess-next',
          prompt: 'SLATE came back with a yellow L and a yellow T. 14 words are left. Which second word?',
          history: [{ guess: 'SLATE', pattern: P('.Y.Y.') }],
          options: [
            { word: 'PILOT', revealPattern: P('.GY.G'), sub: 'L and T both moved to new spots' },
            { word: 'BLOAT', sub: 'T moved, but L is back in spot 2' },
            { word: 'CLOTH', sub: 'L and T in the same spots as before' },
          ],
          correctIdx: 0,
          successNote: 'PILOT leaves about 2 of the 14 on average, BLOAT about 3 and CLOTH about 6; a yellow moved to a new spot either turns green or rules out another spot.',
        },
      ],
    },
  ],
};
