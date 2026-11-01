'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Timer, ArrowLeft, AlertTriangle } from 'lucide-react';
import GameBoard from '@/components/GameBoard';
import Keyboard from '@/components/Keyboard';
import GameOverModal from '@/components/GameOverModal';
import Toast from '@/components/Toast';
import TileSpinner from '@/components/TileSpinner';
import Dialog from '@/components/Dialog';
import AchievementToast, { ACHIEVEMENT_META } from '@/components/AchievementToast';
import GameWaveBackground from '@/components/GameWaveBackground';
import { gamesApi, dailyApi, challengesApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { useAbandonOnExit } from '@/lib/hooks/useAbandonOnExit';
import { Game, GameStatus, TileState, patternToTiles } from '@/lib/types';
import { useSettings } from '@/lib/useSettings';

/** Local date string (YYYY-MM-DD) matching the server's TZ. */
function localDateStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// Flip animation: 5 tiles × 0.15s stagger + 0.5s each tile = ~1.25s total
// Ink-fill reveal: 5 tiles × 80ms stagger + 480ms fill + settle
const FLIP_ANIMATION_MS = 4 * 80 + 480 + 160;

const TILE_WORD: Record<TileState, string> = {
  correct: 'correct',
  present: 'present',
  absent: 'absent',
  empty: 'empty',
  tbd: 'pending',
};

/** Spoken description of a revealed row for the live region. */
function describeRow(rowIndex: number, guess: string, pattern: number): string {
  const tiles = patternToTiles(pattern);
  const parts = guess.split('').map((ch, i) => `${ch} ${TILE_WORD[tiles[i]]}`);
  return `Row ${rowIndex + 1}: ${parts.join(', ')}`;
}

export default function GamePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();

  // ?challenge=<code> is set when the user accepted a challenge that
  // routed them here; the game-over modal uses it to offer a "Back to
  // results" link instead of the generic "create new challenge" CTA.
  const [challengeCode, setChallengeCode] = useState<string | null>(
    () => searchParams?.get('challenge') ?? null,
  );
  const [settings] = useSettings();

  const [game, setGame] = useState<Game | null>(null);
  const [currentGuess, setCurrentGuess] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [patterns, setPatterns] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('in_progress');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // True only while a submitted guess is in flight to the server (before the
  // reveal animation begins) — drives the active-row pulse so the guess
  // registers visually the instant Enter is pressed.
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const [shakeRow, setShakeRow] = useState(-1);
  const [revealRow, setRevealRow] = useState(-1);
  const [toastMsg, setToastMsg] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingGame, setLoadingGame] = useState(true);
  const [unlockedAchievements, setUnlockedAchievements] = useState<
    Array<{ type: string; name: string; icon: string }>
  >([]);
  const [wavePattern, setWavePattern] = useState<number | null>(null);
  const [waveTrigger, setWaveTrigger] = useState(0);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  // Screen-reader announcements (revealed rows + final result).
  const [announcement, setAnnouncement] = useState('');

  // Timer
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, duration = 2000) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
      toastTimeoutRef.current = null;
    }, duration);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Load existing game state on mount
  useEffect(() => {
    if (!id) return;
    if (authLoading) return;

    const loadGame = (g: Game) => {
      setGame(g);
      // Resume: measure elapsed time from the game's real start, not from
      // when this page happened to mount.
      if (g.created_at && (g.moves?.length ?? 0) > 0) {
        const started = new Date(g.created_at).getTime();
        if (!Number.isNaN(started) && started < Date.now()) {
          startTimeRef.current = started;
          setElapsed(Math.floor((Date.now() - started) / 1000));
        }
      }
      if (g.moves && g.moves.length > 0) {
        const sorted = [...g.moves].sort((a, b) => a.move_number - b.move_number);
        setGuesses(sorted.map((m) => m.guess_word));
        setPatterns(sorted.map((m) => m.pattern));
        setRevealRow(-1);
      }
      setGameStatus(g.status);
      if (g.status !== 'in_progress') {
        setModalOpen(true);
      }
    };

    const fetchGame = user
      ? gamesApi.get(id).catch(() => dailyApi.guestGame(id))
      : dailyApi.guestGame(id);

    fetchGame
      .then((res: { data: Game }) => loadGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router, user, authLoading]);

  // Fallback: if the URL didn't carry a ?challenge= param but the loaded
  // game turns out to be a challenge game, resolve the code by matching
  // the game's target_word against the user's known challenges. Covers
  // opening an older challenge game directly (e.g. from the dashboard).
  useEffect(() => {
    if (challengeCode) return;
    if (!user || !game || game.mode !== 'challenge' || !game.target_word) return;
    let cancelled = false;
    challengesApi
      .mine()
      .then((res) => {
        if (cancelled) return;
        const match = (res.data as { code: string; target_word: string | null }[]).find(
          (c) => c.target_word === game.target_word,
        );
        if (match) setChallengeCode(match.code);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [challengeCode, user, game]);

  // Timer — runs while game is in progress
  useEffect(() => {
    if (gameStatus !== 'in_progress') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameStatus]);

  // ── Exit-handling policy ─────────────────────────────────────────────
  // Consequential modes get the browser-native beforeunload prompt as a
  // guard against accidental refresh/close. Daily is retryable, practice
  // is free, so neither warrants the extra friction. All in-progress
  // games still emit a pagehide beacon so the server can mark state
  // cleanly (rated games take their ELO hit here — closing the tab is
  // not an escape hatch).
  const isInProgress = gameStatus === 'in_progress';
  const isChallenge = game?.mode === 'challenge';
  const isRatedComp = !!game?.rated;
  const isConsequential = isInProgress && (isRatedComp || isChallenge);
  // In-app back-button shows confirmation for every mode except practice,
  // since even daily merits a soft "are you sure" against a stray tap.
  const shouldConfirmBack = isInProgress && game?.mode !== 'practice';
  // Hard mode is a property of the game (fixed at creation and enforced
  // server-side), not of the live setting — toggling the setting mid-game
  // must change nothing.
  const hardMode = !!game?.hard_mode;

  useAbandonOnExit({
    gameId: id,
    isActive: isInProgress,
    warn: isConsequential,
  });

  // Build keyboard letter states from all submitted guesses
  const letterStates: Record<string, TileState> = {};
  guesses.forEach((guess: string, idx: number) => {
    if (patterns[idx] === undefined) return;
    const tiles = patternToTiles(patterns[idx]);
    guess.split('').forEach((letter: string, i: number) => {
      const current = letterStates[letter];
      const next = tiles[i];
      if (current === 'correct') return;
      if (current === 'present' && next === 'absent') return;
      letterStates[letter] = next;
    });
  });

  const handleKey = useCallback(
    (key: string) => {
      if (gameStatus !== 'in_progress' || isSubmitting) return;
      if (currentGuess.length < 5) {
        setCurrentGuess((prev: string) => prev + key.toUpperCase());
      }
    },
    [gameStatus, isSubmitting, currentGuess.length]
  );

  const handleBackspace = useCallback(() => {
    if (gameStatus !== 'in_progress' || isSubmitting) return;
    setCurrentGuess((prev: string) => prev.slice(0, -1));
  }, [gameStatus, isSubmitting]);

  const handleEnter = useCallback(async () => {
    if (gameStatus !== 'in_progress' || isSubmitting) return;

    if (currentGuess.length < 5) {
      setShakeRow(guesses.length);
      setTimeout(() => setShakeRow(-1), 500);
      showToast('Not enough letters');
      return;
    }

    // Hard mode pre-check (the server is the authority; this just gives
    // instant feedback): revealed hints must be reused.
    if (hardMode && guesses.length > 0) {
      for (let gi = 0; gi < guesses.length; gi++) {
        const prevGuess = guesses[gi];
        const tiles = patternToTiles(patterns[gi]);
        // Check greens: same letter must appear at same position
        for (let pos = 0; pos < 5; pos++) {
          if (tiles[pos] === 'correct' && currentGuess[pos] !== prevGuess[pos]) {
            setShakeRow(guesses.length);
            setTimeout(() => setShakeRow(-1), 500);
            showToast(`Hard mode: must reuse ${prevGuess[pos]}`);
            return;
          }
        }
        // Check yellows: letter must appear somewhere in guess
        for (let pos = 0; pos < 5; pos++) {
          if (tiles[pos] === 'present' && !currentGuess.includes(prevGuess[pos])) {
            setShakeRow(guesses.length);
            setTimeout(() => setShakeRow(-1), 500);
            showToast(`Hard mode: must reuse ${prevGuess[pos]}`);
            return;
          }
        }
      }
    }

    setIsSubmitting(true);
    setAwaitingResponse(true);

    try {
      const res = user
        ? await gamesApi.submitGuess(id, currentGuess)
        : await dailyApi.guestGuess(id, currentGuess);
      const updatedGame: Game = res.data;
      setAwaitingResponse(false);

      const sortedMoves = [...(updatedGame.moves || [])].sort(
        (a, b) => a.move_number - b.move_number
      );
      const latestMove = sortedMoves[sortedMoves.length - 1];
      const pattern = latestMove?.pattern ?? 0;

      const rowIndex = guesses.length;
      const submitted = currentGuess;

      setGuesses((prev: string[]) => [...prev, submitted]);
      setPatterns((prev: number[]) => [...prev, pattern]);
      setCurrentGuess('');

      if (updatedGame.mode === 'daily') {
        const today = localDateStr();
        const allPatterns = [...patterns, pattern];
        localStorage.setItem(`eloquence_daily_patterns_${today}`, JSON.stringify(allPatterns));
        localStorage.setItem(`eloquence_daily_game_id_${today}`, id);
      }

      setRevealRow(rowIndex);
      setWavePattern(pattern);
      setWaveTrigger((prev: number) => prev + 1);

      setTimeout(() => {
        setRevealRow(-1);

        const status: GameStatus = updatedGame.status;
        setGame(updatedGame);
        setGameStatus(status);

        // Announce the revealed row (and the outcome) once the flip ends.
        const rowText = describeRow(rowIndex, submitted, pattern);
        if (status === 'won') {
          const n = updatedGame.num_guesses || rowIndex + 1;
          setAnnouncement(`${rowText}. You won in ${n} ${n === 1 ? 'guess' : 'guesses'}.`);
        } else if (status === 'lost') {
          setAnnouncement(
            `${rowText}. Out of guesses.${updatedGame.target_word ? ` The word was ${updatedGame.target_word}.` : ''}`,
          );
        } else {
          setAnnouncement(rowText);
        }

        if (status !== 'in_progress') {
          if (updatedGame.mode === 'daily') {
            const today = localDateStr();
            localStorage.setItem(`eloquence_daily_played_${today}`, 'true');
          }

          setTimeout(() => setModalOpen(true), 250);

          const newlyUnlocked: string[] =
            (updatedGame as Game & { newly_unlocked?: string[] }).newly_unlocked || [];
          if (newlyUnlocked.length > 0) {
            const toastAchievements = newlyUnlocked.map((type) => {
              const meta = ACHIEVEMENT_META[type];
              return {
                type,
                name: meta?.name ?? type,
                icon: meta?.icon ?? '🏆',
              };
            });
            setUnlockedAchievements(toastAchievements);
            setTimeout(() => setUnlockedAchievements([]), 5000);
          }
        }

        setIsSubmitting(false);
      }, FLIP_ANIMATION_MS);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const msg = errorMessage(err, 'Something went wrong.');
      const lower = msg.toLowerCase();
      const notInList =
        status === 422 ||
        lower.includes('not in word list') ||
        lower.includes('invalid word') ||
        lower.includes('not a valid');

      if (notInList) {
        setShakeRow(guesses.length);
        setTimeout(() => setShakeRow(-1), 500);
        showToast(lower.includes('not a valid') || status === 422 ? 'Not in word list' : msg);
      } else {
        showToast(msg);
      }
      setAwaitingResponse(false);
      setIsSubmitting(false);
    }
  }, [
    gameStatus,
    isSubmitting,
    currentGuess,
    guesses,
    patterns,
    id,
    user,
    showToast,
    hardMode,
  ]);

  const handleAbandon = async () => {
    setAbandoning(true);
    try {
      await gamesApi.delete(id);
    } catch {
      /* ignore */
    }
    router.push('/play');
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Derive mode label for the pill badge
  const modeLabel = game
    ? game.mode === 'competitive'
      ? game.is_placement
        ? 'Placement'
        : 'Competitive'
      : game.mode.charAt(0).toUpperCase() + game.mode.slice(1)
    : null;

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-52px)]">
        <TileSpinner size="lg" label="Loading game" />
      </div>
    );
  }

  const abandonTitle = isRatedComp
    ? 'Abandon game?'
    : isChallenge
    ? 'Leave challenge?'
    : 'Leave the daily?';

  return (
    <div className="relative z-10 flex flex-col items-center h-[calc(100dvh-52px)] pt-2 pb-2 px-2 select-none">
      <Toast message={toastMsg} visible={toastVisible} />
      <AchievementToast
        achievements={unlockedAchievements}
        onDismiss={() => setUnlockedAchievements([])}
      />
      <GameWaveBackground patterns={patterns} status={gameStatus} triggerKey={waveTrigger} lastPattern={wavePattern} />

      {/* Screen-reader announcements for revealed rows and the result */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      {/* ── Top bar ── */}
      <div className="w-full max-w-lg flex items-center justify-between px-1 mb-2 shrink-0">
        {/* Back button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            if (shouldConfirmBack) {
              setShowAbandonConfirm(true);
            } else {
              router.push('/play');
            }
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors"
          aria-label="Back to mode selection"
        >
          <ArrowLeft size={17} />
        </motion.button>

        {/* Mode pill badge (+ hard-mode pill) */}
        <div className="flex items-center gap-1.5">
          {modeLabel && (
            <span className="rounded-pill bg-bg-muted text-text-secondary text-xs px-3 py-1 font-medium tracking-wide">
              {modeLabel}
            </span>
          )}
          {hardMode && (
            <span
              className="rounded-pill text-xs px-2.5 py-1 font-semibold tracking-wide"
              style={{
                color: 'var(--tile-present)',
                background: 'color-mix(in srgb, var(--tile-present) 15%, transparent)',
              }}
              title="Hard mode: revealed hints must be used"
            >
              Hard
            </span>
          )}
        </div>

        {/* Timer (competitive only) */}
        {game?.mode === 'competitive' ? (
          <div className="flex items-center gap-1.5 text-text-secondary text-xs font-mono tabular-nums min-w-[44px] justify-end">
            <Timer size={13} strokeWidth={1.8} />
            <span>{formatTime(elapsed)}</span>
          </div>
        ) : (
          /* Spacer to keep pill centered when no timer */
          <div className="w-8" />
        )}
      </div>

      {/* ── Board — flex-1 so it takes available space between header and keyboard ── */}
      <div className="flex-1 flex items-center justify-center w-full">
        <GameBoard
          guesses={guesses}
          patterns={patterns}
          currentGuess={currentGuess}
          shakeRow={shakeRow}
          revealRow={revealRow}
          isAwaiting={awaitingResponse}
        />
      </div>

      {/* ── Virtual keyboard ── */}
      <div className="w-full flex justify-center shrink-0 pb-safe">
        <Keyboard
          onKey={handleKey}
          onEnter={handleEnter}
          onBackspace={handleBackspace}
          letterStates={letterStates}
          // Physical keys are ignored while any dialog is open so typing
          // never continues behind the modal.
          disablePhysicalKeyboard={settings.keyboardOnly || showAbandonConfirm || modalOpen}
        />
      </div>

      {/* ── Abandon confirmation ── */}
      <Dialog
        open={showAbandonConfirm}
        onClose={() => setShowAbandonConfirm(false)}
        title={abandonTitle}
        accent="var(--red)"
        locked={abandoning}
        maxWidth="max-w-xs"
        hideClose
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--red) 12%, transparent)' }}
            >
              <AlertTriangle size={20} style={{ color: 'var(--red)' }} />
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {isRatedComp ? (
                <>
                  This counts as a{' '}
                  <span className="font-semibold" style={{ color: 'var(--red)' }}>loss</span> and you
                  will lose ELO.
                </>
              ) : isChallenge ? (
                <>
                  You won&apos;t be able to replay this challenge — the word will be{' '}
                  <span className="font-semibold" style={{ color: 'var(--red)' }}>locked</span> for you.
                </>
              ) : (
                <>
                  Your current attempt will be marked abandoned. You can come back and
                  try today&apos;s word again.
                </>
              )}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              data-autofocus
              onClick={() => setShowAbandonConfirm(false)}
              disabled={abandoning}
              className="flex-1 py-2.5 rounded-md border-2 border-border-default hover:border-border-strong text-text-primary font-medium text-xs transition-colors disabled:opacity-50"
            >
              Keep playing
            </button>
            <button
              type="button"
              onClick={handleAbandon}
              disabled={abandoning}
              className="flex-1 py-2.5 rounded-md text-white font-medium text-xs transition-[filter] hover:brightness-110 disabled:opacity-60"
              style={{ backgroundColor: 'var(--red)' }}
            >
              {abandoning ? 'Leaving...' : isRatedComp ? 'Abandon' : 'Leave'}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ── Game over modal ── */}
      {game && (
        <GameOverModal
          game={game}
          open={modalOpen}
          isGuest={!user}
          onClose={() => setModalOpen(false)}
          gamesPlayed={user?.games_played}
          challengeCode={challengeCode}
        />
      )}
    </div>
  );
}
