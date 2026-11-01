'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Share2, Check, X } from 'lucide-react';
import { Game, patternToTiles } from '@/lib/types';
import { MODES, TERMS, fmtInt, ratingDelta, resultSentence } from '@/lib/copy';
import { Button, CountUp, Detail, Hint, Label, MiniTiles } from '@/components/ui';
import { takeaway, totalBits } from '@/components/play/takeaway';
import EloProjection from './EloProjection';
import Confetti from './Confetti';
import Dialog from './Dialog';

interface GameOverModalProps {
  game: Game;
  open: boolean;
  isGuest?: boolean;
  onClose?: () => void;
  gamesPlayed?: number;
  /** The player's Daily streak after this game (from the refreshed user). */
  streak?: number;
  // When the finished game was a Friends game, this is the shareable code so
  // the modal can offer a link to everyone's results.
  challengeCode?: string | null;
}

/**
 * Emoji palette for the share grid. Colour-blind mode uses the orange/blue
 * pair (matching the in-app high-contrast tiles); absent tiles follow the
 * theme like Wordle (white square on light, black on dark).
 */
function tileEmoji(): Record<string, string> {
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const colorblind = !!root?.classList.contains('colorblind');
  const dark = root?.dataset.theme === 'dark';
  return {
    correct: colorblind ? '🟧' : '🟩',
    present: colorblind ? '🟦' : '🟨',
    absent: dark ? '⬛' : '⬜',
  };
}

type CelebrationTier = 'legendary' | 'impressive' | 'solid' | 'close_call';

function getCelebrationTier(numGuesses: number): CelebrationTier {
  if (numGuesses <= 2) return 'legendary';
  if (numGuesses === 3) return 'impressive';
  if (numGuesses <= 4) return 'solid';
  return 'close_call';
}

/* Hairline that reads on the ink block (border tokens are ink-on-ink here). */
const ON_INK_RULE = '1px solid color-mix(in srgb, var(--text-on-ink) 22%, transparent)';
const ON_INK_BTN: React.CSSProperties = { color: 'var(--text-on-ink)', borderColor: 'var(--text-on-ink)' };

function PlacementSquares({ done }: { done: number }) {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className="block w-3 h-3"
          style={{
            backgroundColor: i < done ? 'var(--text-on-ink)' : 'transparent',
            border: '1.5px solid var(--text-on-ink)',
          }}
        />
      ))}
    </span>
  );
}

/** One number with its label, for the Detailed sheet (paper, not ink). */
function NumberRow({ label, value, sub }: { label: React.ReactNode; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rule-hair pt-2 min-w-0">
      <Label className="block">{label}</Label>
      <div className="font-display text-display-sm text-text-primary tabular mt-0.5 leading-none">{value}</div>
      {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}

function formatTime(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ---- Main component ----------------------------------------------------------

export default function GameOverModal({
  game,
  open,
  isGuest = false,
  onClose,
  gamesPlayed,
  streak,
  challengeCode = null,
}: GameOverModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const won = game.status === 'won';
  const celebrationTier = won ? getCelebrationTier(game.num_guesses) : null;
  const mode = MODES[game.mode];

  // What the response actually carries — show only what exists.
  const hasRating = !!game.rated && game.elo_before != null && game.elo_after != null;
  const ratingBefore = hasRating ? Math.round(game.elo_before as number) : null;
  const ratingAfter = hasRating ? Math.round(game.elo_after as number) : null;
  const delta = hasRating ? ratingDelta((game.elo_after as number) - (game.elo_before as number)) : null;
  const showStreak = game.mode === 'daily' && !isGuest && won && typeof streak === 'number' && streak > 0;
  const lesson = takeaway(game);
  const bits = totalBits(game);

  const buildShareText = () => {
    const header = `ELOquence ${mode.name} ${won ? game.num_guesses : 'X'}/6${
      game.hard_mode ? '*' : ''
    }${won && game.num_guesses <= 3 ? ' ⭐' : ''}`;
    const emoji = tileEmoji();
    const grid = [...(game.moves ?? [])]
      .sort((a, b) => a.move_number - b.move_number)
      .map((move) => {
        const tiles = patternToTiles(move.pattern);
        return tiles.map((t) => emoji[t] ?? emoji.absent).join('');
      })
      .join('\n');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return [header, '', grid, '', origin].join('\n').trim();
  };

  const handleShare = async () => {
    const text = buildShareText();
    // Native share sheet on mobile; clipboard everywhere else.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        // User dismissed the sheet — nothing to do. Any other failure falls
        // through to the clipboard.
        if ((err as { name?: string })?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  // The answer as a row of mini tiles: green when solved, grey when missed.
  const word = (game.target_word ?? '').toUpperCase();
  const wordStates = Array(word.length).fill(won ? 'correct' : 'absent') as ('correct' | 'absent')[];

  // Secondary action: "Play again" where a new board can start at once,
  // otherwise back to the board list.
  const canReplay = game.mode === 'competitive' || game.mode === 'practice';
  const playAgain = () => router.push(canReplay ? `/play?mode=${game.mode}` : '/play');

  const shareLink = (
    <button type="button" onClick={handleShare} className="ink-link inline-flex items-center gap-1.5 text-xs text-text-on-ink opacity-80 hover:opacity-100">
      {copied ? <Check size={12} aria-hidden="true" /> : <Share2 size={12} aria-hidden="true" />}
      {copied ? 'Copied' : 'Share your result'}
    </button>
  );

  return (
    <>
      <Confetti
        active={
          open &&
          (celebrationTier === 'legendary' || celebrationTier === 'impressive')
        }
      />

      <Dialog
        open={open}
        onClose={onClose}
        label={won ? 'Game won' : 'Game over'}
        maxWidth="max-w-md"
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        hideClose
      >
        {/* Ink block sheet — the one ink block on the screen */}
        <div className="relative bg-bg-ink text-text-on-ink p-6 md:p-8 flex flex-col gap-6">
          <button
            type="button"
            onClick={() => onClose?.()}
            aria-label="Close"
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity duration-fast"
          >
            <X size={16} />
          </button>

          {/* Result */}
          <div className="pr-8">
            <Label className="block !text-text-on-ink opacity-60">
              {mode.name}
              {game.hard_mode ? ` · ${TERMS.hardMode.name.toLowerCase()}` : ''}
            </Label>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }}
              className="font-display text-display-lg mt-2 text-balance"
            >
              {resultSentence(game.status, game.num_guesses)}
              {!won && word ? ` — the word was ${word}` : ''}
            </motion.h2>
          </div>

          {/* The word */}
          {word && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 }}
            >
              <Label className="block !text-text-on-ink opacity-60 mb-2">the word</Label>
              <MiniTiles word={word} states={wordStates} size={44} gap={5} />
            </motion.div>
          )}

          {/* Rating / streak — only what this mode changes */}
          {(hasRating || showStreak || lesson) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.25 }}
              className="flex flex-col gap-3 pt-4"
              style={{ borderTop: ON_INK_RULE }}
            >
              {hasRating && (
                <p className="text-base">
                  <Hint term="rating">{TERMS.rating.name}</Hint>{' '}
                  <span className="font-display font-bold tabular">
                    {ratingBefore} → <CountUp value={ratingAfter as number} decimals={0} />
                  </span>{' '}
                  <span className="font-mono text-sm tabular">({delta})</span>
                </p>
              )}

              {hasRating && !isGuest && game.is_placement && (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm opacity-80">
                    <Hint term="placement">{TERMS.placement.name}</Hint>
                    {gamesPlayed != null ? ` · ${Math.min(gamesPlayed, 5)}/5` : ''}
                  </p>
                  <PlacementSquares done={Math.min(gamesPlayed ?? 0, 5)} />
                </div>
              )}

              {showStreak && (
                <p className="text-base">
                  <Hint term="streak">{TERMS.streak.name}</Hint>{' '}
                  <span className="font-display font-bold tabular">{streak}</span>{' '}
                  <span className="text-sm opacity-80">{streak === 1 ? 'day' : 'days in a row'}</span>
                </p>
              )}

              {lesson && <p className="text-sm opacity-90 leading-relaxed">{lesson}</p>}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {isGuest ? (
              <>
                <Button size="lg" onClick={() => router.push('/play')} className="w-full">
                  Back to Play
                </Button>
                <Button variant="secondary" onClick={() => onClose?.()} style={ON_INK_BTN}>
                  Look at the board
                </Button>
                <div className="flex items-center justify-between gap-4 mt-2">
                  {shareLink}
                  <p className="text-xs opacity-70 text-right">
                    <button
                      type="button"
                      onClick={() => router.push('/login')}
                      className="ink-link font-semibold text-text-on-ink"
                    >
                      Sign in
                    </button>{' '}
                    to get a rating and keep every game.
                  </p>
                </div>
              </>
            ) : (
              <>
                <Button size="lg" onClick={() => router.push(`/review/${game.id}`)} className="w-full">
                  See the review
                </Button>
                <div className={game.mode === 'challenge' && challengeCode ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-1 gap-2'}>
                  {game.mode === 'challenge' && challengeCode && (
                    <Button
                      variant="secondary"
                      onClick={() => router.push(`/challenge/${challengeCode}`)}
                      style={ON_INK_BTN}
                    >
                      Everyone&apos;s results
                    </Button>
                  )}
                  <Button variant="secondary" onClick={playAgain} style={ON_INK_BTN}>
                    {canReplay ? 'Play again' : 'Back to Play'}
                  </Button>
                </div>
                <div className="mt-2">{shareLink}</div>
              </>
            )}
          </div>
        </div>

        {/* Detailed view: the numbers, on paper under the ink block */}
        <Detail>
          <div className="px-6 md:px-8 py-5 flex flex-col gap-4 rule-top">
            <Label>the numbers</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
              <NumberRow label="guesses" value={`${won ? game.num_guesses : 'X'}/6`} />
              {hasRating && (
                <NumberRow
                  label={<Hint term="rating">{TERMS.rating.name}</Hint>}
                  value={delta ?? '—'}
                  sub={`${ratingBefore} → ${ratingAfter}`}
                />
              )}
              {game.word_difficulty != null && (
                <NumberRow label={<Hint term="wordRating">{TERMS.wordRating.name}</Hint>} value={fmtInt(Math.round(game.word_difficulty))} />
              )}
              {game.accuracy_score != null && (
                <NumberRow label={<Hint term="accuracy">{TERMS.accuracy.name}</Hint>} value={Math.round(game.accuracy_score)} sub="0–100" />
              )}
              {game.luck_factor != null && (
                <NumberRow label={<Hint term="luck">{TERMS.luck.name}</Hint>} value={Math.round(game.luck_factor)} sub="0–100" />
              )}
              {bits != null && (
                <NumberRow label={<Hint term="information">{TERMS.information.name}</Hint>} value={`${bits.toFixed(1)} ${TERMS.information.unit}`} />
              )}
              {game.time_seconds != null && <NumberRow label="time" value={formatTime(game.time_seconds)} />}
            </div>
            {hasRating && game.accuracy_score != null && (
              <EloProjection game={game} accuracy={game.accuracy_score} />
            )}
          </div>
        </Detail>
      </Dialog>
    </>
  );
}
