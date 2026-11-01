'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Share2, Check, X } from 'lucide-react';
import { Game, patternToTiles } from '@/lib/types';
import { challengesApi } from '@/lib/api';
import { Button, CountUp, Label, MiniTiles } from '@/components/ui';
import Confetti from './Confetti';
import Dialog from './Dialog';

interface GameOverModalProps {
  game: Game;
  open: boolean;
  isGuest?: boolean;
  onClose?: () => void;
  gamesPlayed?: number;
  // When the finished game was a challenge play, this is the shareable
  // challenge code so the modal can offer a "Back to results" link
  // (the leaderboard of everyone who took the same challenge) instead
  // of the generic "Challenge a friend" CTA.
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

const WON_MESSAGES: Record<CelebrationTier, string> = {
  legendary: 'Outstanding!',
  impressive: 'Brilliant solve!',
  solid: 'Well played!',
  close_call: 'Survived!',
};

function getCelebrationTier(numGuesses: number): CelebrationTier {
  if (numGuesses <= 2) return 'legendary';
  if (numGuesses === 3) return 'impressive';
  if (numGuesses <= 4) return 'solid';
  return 'close_call';
}

/* Hairline that reads on the ink block (border tokens are ink-on-ink here). */
const ON_INK_RULE = '1px solid color-mix(in srgb, var(--text-on-ink) 22%, transparent)';
const ON_INK_BTN: React.CSSProperties = { color: 'var(--text-on-ink)', borderColor: 'var(--text-on-ink)' };

function InkStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="pt-3 min-w-0" style={{ borderTop: ON_INK_RULE }}>
      <Label className="block !text-text-on-ink opacity-60">{label}</Label>
      <div className="font-display text-display-md tabular mt-1 leading-none">{children}</div>
    </div>
  );
}

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

// ---- Main component ----------------------------------------------------------

export default function GameOverModal({
  game,
  open,
  isGuest = false,
  onClose,
  gamesPlayed,
  challengeCode = null,
}: GameOverModalProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [challengeCopied, setChallengeCopied] = useState(false);

  const won = game.status === 'won';
  const eloDelta = game.elo_delta;
  const showElo = eloDelta !== null && game.rated;
  const celebrationTier = won ? getCelebrationTier(game.num_guesses) : null;
  const modeLabel = game.mode === 'competitive' && game.is_placement ? 'placement' : game.mode;

  const buildShareText = () => {
    const modeLabel = game.mode.charAt(0).toUpperCase() + game.mode.slice(1);
    const header = `ELOquence ${modeLabel} ${won ? game.num_guesses : 'X'}/6${
      game.hard_mode ? '*' : ''
    }${won && game.num_guesses <= 3 ? ' ⭐' : ''}`;
    const wordElo = game.word_difficulty
      ? `Word ELO: ${Math.round(game.word_difficulty).toLocaleString()}`
      : '';
    const emoji = tileEmoji();
    const grid = [...(game.moves ?? [])]
      .sort((a, b) => a.move_number - b.move_number)
      .map((move) => {
        const tiles = patternToTiles(move.pattern);
        return tiles.map((t) => emoji[t] ?? emoji.absent).join('');
      })
      .join('\n');
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return [header, wordElo, '', grid, '', origin]
      .filter((l) => l !== undefined)
      .join('\n')
      .trim();
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

  const handleChallenge = async () => {
    try {
      const res = await challengesApi.create();
      const url = `${window.location.origin}/challenge/${res.data.code}`;
      await navigator.clipboard.writeText(url);
      setChallengeCopied(true);
      setTimeout(() => setChallengeCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  // The answer as a row of mini tiles: green when solved, grey when missed.
  const word = (game.target_word ?? '').toUpperCase();
  const wordStates = Array(word.length).fill(won ? 'correct' : 'absent') as ('correct' | 'absent')[];

  const delta = Math.round(eloDelta ?? 0);
  const statCount = 1 + (showElo ? 1 : 0) + (game.word_difficulty ? 1 : 0);

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
        hideClose
      >
        {/* Ink block sheet */}
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
              {modeLabel}
              {game.hard_mode ? ' · hard' : ''}
              {' · '}
              {won ? `${game.num_guesses}/6` : 'x/6'}
              {celebrationTier ? ` · ${WON_MESSAGES[celebrationTier].toLowerCase()}` : ''}
            </Label>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.05 }}
              className="font-display text-display-lg mt-2"
            >
              {won ? `Solved in ${game.num_guesses}` : 'Not this time'}
            </motion.h2>
          </div>

          {/* The word */}
          {word && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.15 }}
            >
              <Label className="block !text-text-on-ink opacity-60 mb-2">
                {won ? 'the word' : 'the word was'}
              </Label>
              <MiniTiles word={word} states={wordStates} size={44} gap={5} />
            </motion.div>
          )}

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay: 0.25 }}
            className={`grid gap-4 ${statCount === 3 ? 'grid-cols-3' : statCount === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
          >
            <InkStat label="guesses">
              {won ? game.num_guesses : 'X'}
              <span className="opacity-50 text-[0.6em]">/6</span>
            </InkStat>

            {showElo && (
              <InkStat label="rating">
                <span className="text-accent">{delta >= 0 ? '+' : '−'}</span>
                <CountUp value={Math.abs(delta)} decimals={0} />
              </InkStat>
            )}

            {game.word_difficulty && (
              <InkStat label="word elo">
                <CountUp value={Math.round(game.word_difficulty)} decimals={0} />
              </InkStat>
            )}
          </motion.div>

          {/* Placement progress */}
          {!isGuest && game.is_placement && (
            <div className="flex items-center justify-between gap-4 pt-3" style={{ borderTop: ON_INK_RULE }}>
              <div>
                <Label className="block !text-text-on-ink opacity-60">
                  placement{gamesPlayed != null ? ` · ${Math.min(gamesPlayed, 5)}/5` : ''}
                </Label>
                <p className="text-xs opacity-80 mt-1">Results count toward your initial rating.</p>
              </div>
              <PlacementSquares done={Math.min(gamesPlayed ?? 0, 5)} />
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {isGuest ? (
              <>
                <Button size="lg" onClick={() => onClose?.()} className="w-full">
                  Admire puzzle
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={handleShare} style={ON_INK_BTN}>
                    {copied ? <Check size={14} /> : <Share2 size={14} />}
                    {copied ? 'Copied' : 'Share'}
                  </Button>
                  <Button variant="secondary" onClick={() => router.push('/play')} style={ON_INK_BTN}>
                    Play again
                  </Button>
                </div>
                <p className="text-xs opacity-70 mt-2">
                  Sign in to get rated and keep a record of every game.{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="ink-link font-semibold text-text-on-ink"
                  >
                    Sign in
                  </button>
                </p>
              </>
            ) : (
              <>
                <Button size="lg" onClick={() => router.push(`/review/${game.id}`)} className="w-full">
                  Review game
                </Button>
                <div className="grid grid-cols-3 gap-2">
                  <Button variant="secondary" size="sm" onClick={handleShare} style={ON_INK_BTN}>
                    {copied ? <Check size={13} /> : <Share2 size={13} />}
                    {copied ? 'Copied' : 'Share'}
                  </Button>
                  {game.mode === 'challenge' && challengeCode ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push(`/challenge/${challengeCode}`)}
                      style={ON_INK_BTN}
                    >
                      Results
                    </Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={handleChallenge} style={ON_INK_BTN}>
                      {challengeCopied ? <Check size={13} /> : null}
                      {challengeCopied ? 'Copied' : 'Challenge'}
                    </Button>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => router.push('/play')} style={ON_INK_BTN}>
                    Back
                  </Button>
                </div>
                <p className="font-mono text-[11px] opacity-60 mt-1">challenge copies a link a friend can play.</p>
              </>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
