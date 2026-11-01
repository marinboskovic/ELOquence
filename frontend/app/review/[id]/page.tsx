'use client';
/**
 * Post-game review.
 *
 * Simple view (default) reads as a story: your game → the board → one
 * takeaway → guess by guess → two numbers → ask the coach → play again.
 * Detailed view keeps the step-by-step engine walkthrough (overview table,
 * one step per guess, other players) for the thesis layer.
 */
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import clsx from 'clsx';
import CoachChat from '@/components/CoachChat';
import EloProjection from '@/components/EloProjection';
import Tile from '@/components/Tile';
import TileLoader from '@/components/TileLoader';
import { Button, ButtonLink, Detail, DetailToggle, Hint, Label, MiniTiles, SectionHead, Tag } from '@/components/ui';
import { gamesApi, analysisApi } from '@/lib/api';
import { MODES, TERMS, fmtInt, ratingDelta, resultSentence, type Term } from '@/lib/copy';
import { Game, AnalysisResult, patternToTiles } from '@/lib/types';
import { useViewMode } from '@/lib/viewMode';
import CommunityPanel from '@/app/review/_components/CommunityPanel';
import GuessDetail from '@/app/review/_components/GuessDetail';
import GuessList from '@/app/review/_components/GuessList';
import HintStat from '@/app/review/_components/HintStat';
import StatsTable from '@/app/review/_components/StatsTable';
import Takeaway from '@/app/review/_components/Takeaway';
import {
  buildTakeaway,
  coachPrompts,
  headlineLuck,
  headlineSkill,
  luckSentence,
  skillSentence,
} from '@/app/review/_components/takeaway';

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton bg-bg-muted', className)} />;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
}

/* ------------------------------------------------------------------ */
/* Board (the real tiles) + navigator (mini tiles)                      */
/* ------------------------------------------------------------------ */

function Board({ guesses, patterns, onRowClick }: { guesses: string[]; patterns: number[]; onRowClick?: (row: number) => void }) {
  return (
    <div role="grid" aria-label="Game board" className="flex flex-col" style={{ gap: 'var(--tile-gap)' }}>
      {Array.from({ length: 6 }).map((_, row) => {
        const guess = guesses[row] || '';
        const tiles = patterns[row] !== undefined ? patternToTiles(patterns[row]) : null;
        const hasGuess = !!guess;
        const clickable = hasGuess && !!onRowClick;
        return (
          <div
            key={row}
            role="row"
            onClick={() => clickable && onRowClick(row)}
            className={clsx('flex', clickable && 'cursor-pointer')}
            style={{ gap: 'var(--tile-gap)' }}
            title={clickable ? `Go to guess ${row + 1}` : undefined}
          >
            {Array.from({ length: 5 }).map((_, col) => (
              <div key={col} role="gridcell">
                <Tile letter={guess[col] ?? ''} state={tiles ? tiles[col] : 'empty'} position={col} size="clamp(36px, 5vw, 48px)" />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function NavigatorGrid({
  guesses,
  patterns,
  activeRow,
  onRowClick,
}: {
  guesses: string[];
  patterns: number[];
  activeRow: number;
  onRowClick: (row: number) => void;
}) {
  return (
    <div className="flex flex-col gap-[3px]" role="list" aria-label="Jump to a guess">
      {Array.from({ length: 6 }).map((_, row) => {
        const guess = guesses[row] || '';
        const pat = patterns[row] !== undefined ? patterns[row] : null;
        const tiles = pat !== null ? patternToTiles(pat) : null;
        const isActive = row === activeRow;
        const hasGuess = !!guess;
        const states = tiles ? (tiles as ('correct' | 'present' | 'absent' | 'empty')[]) : Array.from({ length: 5 }, () => 'empty' as const);

        return (
          <button
            key={row}
            type="button"
            role="listitem"
            disabled={!hasGuess}
            onClick={() => hasGuess && onRowClick(row)}
            aria-label={hasGuess ? `Go to guess ${row + 1}` : `Empty row ${row + 1}`}
            aria-current={isActive ? 'true' : undefined}
            className={clsx(
              'flex items-center gap-2 p-0 border-0 bg-transparent transition-opacity duration-fast',
              hasGuess ? 'cursor-pointer' : 'cursor-default',
              hasGuess && !isActive && 'opacity-50 hover:opacity-100'
            )}
          >
            <span className={clsx('block w-[2px] h-5', isActive ? 'bg-accent' : 'bg-transparent')} aria-hidden="true" />
            <MiniTiles word={hasGuess ? guess : '     '} states={states} size={22} gap={3} />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Game meta line — shared by both views                                */
/* ------------------------------------------------------------------ */

function GameMeta({ game }: { game: Game }) {
  const delta = game.rated && game.elo_delta != null && game.elo_delta !== 0 ? game.elo_delta : null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {delta != null && (
        <Tag tone={delta > 0 ? 'green' : 'neutral'}>
          <Hint term="rating">Rating</Hint>&nbsp;{ratingDelta(delta)}
        </Tag>
      )}
      {game.hard_mode && (
        <Tag>
          <Hint term="hardMode" />
        </Tag>
      )}
      {game.word_difficulty != null && (
        <Detail>
          <span className="font-mono text-xs tabular text-text-secondary inline-flex items-center gap-1.5">
            <Hint term="wordRating" /> <span className="text-text-primary font-semibold">{fmtInt(Math.round(game.word_difficulty))}</span>
          </span>
        </Detail>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Simple view                                                          */
/* ------------------------------------------------------------------ */

function SimpleReview({
  game,
  analysis,
  loading,
  guesses,
  patterns,
}: {
  game: Game;
  analysis: AnalysisResult | null;
  loading: boolean;
  guesses: string[];
  patterns: number[];
}) {
  const jumpToGuess = useCallback((row: number) => {
    const el = document.getElementById(`guess-${row + 1}`);
    el?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
  }, []);

  const skill = analysis ? headlineSkill(analysis) : null;
  const luck = analysis ? headlineLuck(analysis) : null;
  const takeaway = analysis ? buildTakeaway(analysis, game) : null;

  return (
    <div className="flex flex-col gap-16">
      {/* The word and the board */}
      <section className="grid md:grid-cols-12 gap-8 items-start" aria-label="The board">
        <div className="md:col-span-7 flex flex-col gap-3">
          <Label>the word</Label>
          <p className="font-display text-display-lg text-text-primary uppercase break-words">{game.target_word ?? '—'}</p>
          <p className="font-sans text-base text-text-secondary max-w-[40ch]">
            {game.status === 'won'
              ? `You found it in ${game.num_guesses}. Tap a row on the board to jump to that guess.`
              : game.status === 'lost'
              ? 'Six guesses were not enough this time. Tap a row on the board to see where it went.'
              : 'This game is still in progress.'}
          </p>
        </div>
        <div className="md:col-span-5 flex md:justify-end">
          <Board guesses={guesses} patterns={patterns} onRowClick={analysis ? jumpToGuess : undefined} />
        </div>
      </section>

      {loading && (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Looking at your game">
          <Skeleton className="h-32" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-16" />
        </div>
      )}

      {analysis && takeaway && (
        <>
          <Takeaway text={takeaway} />

          <section aria-labelledby="guess-by-guess">
            <SectionHead eyebrow="what happened" title={<span id="guess-by-guess">Guess by guess</span>} />
            <div className="mt-2">
              <GuessList analysis={analysis} />
            </div>
          </section>

          <section aria-labelledby="two-numbers">
            <SectionHead eyebrow="how it went" title={<span id="two-numbers">Two numbers</span>} aside="Tap a label to see what it means." />
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 max-w-xl">
              <HintStat term="skill" value={skill ?? 0} size="lg" sub={skill != null ? skillSentence(skill) : undefined} />
              <HintStat term="luck" value={luck ?? 0} size="lg" sub={luck != null ? luckSentence(luck) : undefined} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Detailed view — step panels                                          */
/* ------------------------------------------------------------------ */

function StepOverview({
  analysis,
  activeRow,
  showExplanation,
  setShowExplanation,
  game,
  guesses,
  patterns,
  onRowClick,
}: {
  analysis: AnalysisResult;
  activeRow: number;
  showExplanation: boolean;
  setShowExplanation: (fn: (v: boolean) => boolean) => void;
  game: Game | null;
  guesses: string[];
  patterns: number[];
  onRowClick: (row: number) => void;
}) {
  const skill = headlineSkill(analysis);
  const luck = headlineLuck(analysis);
  const openerSub =
    (analysis.opener_total_games ?? 0) > 1
      ? `${analysis.opener_rarity_pct ?? 0}% of players start with something else`
      : 'first game with this word';

  return (
    <div className="pt-2">
      {/* Editorial spread: word + result left, the real board right */}
      <div className="grid md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-7 flex flex-col gap-4">
          <p className="font-display text-display-lg text-text-primary uppercase break-words">{game?.target_word ?? '—'}</p>
          <p className="font-display text-display-sm text-text-primary">{game ? resultSentence(game.status, game.num_guesses) : '—'}</p>
          <div className="flex flex-col gap-1 font-mono text-xs text-text-secondary tabular">
            <span>
              {game ? MODES[game.mode]?.name ?? game.mode : '—'}
              {game?.rated ? ' · counts for rating' : ''}
            </span>
            {game?.created_at && <span>{new Date(game.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
          </div>
          {game && <GameMeta game={game} />}
        </div>
        <div className="md:col-span-5 flex md:justify-end">
          <Board guesses={guesses} patterns={patterns} onRowClick={onRowClick} />
        </div>
      </div>

      {/* Headline numbers */}
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-6">
        <HintStat term="skill" value={skill} size="lg" sub={skillSentence(skill)} />
        <HintStat term="luck" value={luck} size="lg" sub={luckSentence(luck)} />
        <HintStat term="opener" value={(analysis.opener_word || '—').toUpperCase()} size="lg" sub={openerSub} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="mt-10">
        <StatsTable moves={analysis.moves} activeRow={activeRow} />
      </div>

      <div className="mt-6">
        <p className="font-sans text-sm text-text-secondary mb-2">Skill is about your choices; luck is about how the tiles fell. They are judged separately.</p>

        <button
          onClick={() => setShowExplanation((v) => !v)}
          className="ink-link font-mono text-label uppercase text-text-primary"
          aria-expanded={showExplanation}
        >
          {showExplanation ? 'hide the column guide' : 'what the columns mean'}
        </button>

        <AnimatePresence>
          {showExplanation && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
              className="overflow-hidden"
            >
              {/* Rating ledger — first thing the player sees when they open the guide. */}
              {game && game.rated && game.accuracy_score != null && (
                <div className="mt-4">
                  <EloProjection game={game} accuracy={game.accuracy_score} />
                </div>
              )}

              <div className="mt-6 rule-top pt-4">
                <Label className="block mb-3">what the columns mean</Label>
                {(['skill', 'luck', 'wordsLeft', 'information'] as const).map((k) => {
                  const t: Term = TERMS[k];
                  return (
                    <p key={k} className="rule-hair py-3 font-sans text-sm leading-relaxed text-text-secondary">
                      <strong className="text-text-primary font-semibold">
                        {t.name}
                        {t.unit ? ` (${t.unit})` : ''}
                      </strong>{' '}
                      &mdash; {t.simple} {t.detail}
                    </p>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepFinal({ game, analysis }: { game: Game | null; analysis: AnalysisResult }) {
  const skill = headlineSkill(analysis);
  const luck = headlineLuck(analysis);
  return (
    <div>
      <div className="rule-top pt-3">
        <Label className="block mb-1">wrap-up</Label>
        <h2 className="font-display text-display-md text-text-primary">How it went</h2>
      </div>
      <p className="font-sans text-base text-text-secondary mt-4 max-w-[52ch]">{buildTakeaway(analysis, game)}</p>
      <div className="mt-6 grid grid-cols-2 gap-x-6 max-w-md">
        <HintStat term="skill" value={skill} sub={skillSentence(skill)} />
        <HintStat term="luck" value={luck} sub={luckSentence(luck)} />
      </div>
      {game && game.status !== 'in_progress' && game.user_id && (
        <CommunityPanel gameId={game.id} targetWord={game.target_word} playerGuesses={game.num_guesses} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main page                                                            */
/* ------------------------------------------------------------------ */

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { detailed } = useViewMode();

  const [game, setGame] = useState<Game | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loadingGame, setLoadingGame] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [showExplanation, setShowExplanation] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detailed view stepper. Steps:
  //   0           — Overview (board + numbers table)
  //   1..N        — One per guess (GuessDetail)
  //   N+1         — Wrap-up (takeaway + other players)
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDir, setStepDir] = useState<1 | -1>(1);
  // Per-move AI commentary survives step nav so flipping back to a guess
  // doesn't re-call the API. Keyed by move_number.
  const aiCacheRef = useRef<Map<number, string>>(new Map());
  const moveCount = analysis?.moves.length ?? 0;
  const totalSteps = moveCount > 0 ? moveCount + 2 : 1;
  // -1 = no row is "current" (Overview / Wrap-up). Per-guess steps map to
  // their move index; used to highlight the row in the navigator and table.
  const activeRow = currentStep >= 1 && currentStep <= moveCount ? currentStep - 1 : -1;

  useEffect(() => {
    if (!id) return;
    gamesApi
      .get(id)
      .then((res: { data: Game }) => setGame(res.data))
      .catch(() => router.push('/play'))
      .finally(() => setLoadingGame(false));
  }, [id, router]);

  const runAnalysis = useCallback(async () => {
    if (!id) return;
    setLoadingAnalysis(true);
    setAnalysisError('');
    try {
      const res = await analysisApi.analyze(id);
      setAnalysis(res.data);
    } catch {
      setAnalysisError('We could not look at this game right now.');
    } finally {
      setLoadingAnalysis(false);
    }
  }, [id]);

  useEffect(() => {
    if (game && game.status !== 'in_progress') {
      runAnalysis();
    }
  }, [game, runAnalysis]);

  const goToStep = useCallback(
    (next: number) => {
      if (totalSteps <= 1) return;
      const clamped = Math.max(0, Math.min(totalSteps - 1, next));
      setCurrentStep((prev) => {
        if (clamped === prev) return prev;
        setStepDir(clamped > prev ? 1 : -1);
        return clamped;
      });
    },
    [totalSteps]
  );
  // Functional setters so rapid presses don't stale-capture currentStep
  const goPrev = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      if (prev <= 0) return prev;
      setStepDir(-1);
      return prev - 1;
    });
  }, [totalSteps]);
  const goNext = useCallback(() => {
    if (totalSteps <= 1) return;
    setCurrentStep((prev) => {
      if (prev >= totalSteps - 1) return prev;
      setStepDir(1);
      return prev + 1;
    });
  }, [totalSteps]);
  // Clicking a board/navigator row jumps to that guess's step (step 0 is the overview)
  const goToMoveRow = useCallback((row: number) => goToStep(row + 1), [goToStep]);

  // Keyboard navigation (Detailed only) — ignore when typing in a field
  useEffect(() => {
    if (!detailed) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || t.isContentEditable) return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToStep(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToStep(totalSteps - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailed, goPrev, goNext, goToStep, totalSteps]);

  // Clamp current step if the analysis arrives and we're somehow past the end
  useEffect(() => {
    if (currentStep > totalSteps - 1) setCurrentStep(totalSteps - 1);
  }, [totalSteps, currentStep]);

  function handleShare() {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2200);
  }

  const sortedMoves = game?.moves ? [...game.moves].sort((a, b) => a.move_number - b.move_number) : [];
  const guesses = sortedMoves.map((m) => m.guess_word);
  const boardPatterns = sortedMoves.map((m) => m.pattern);

  const wonGame = game?.status === 'won';
  const lostGame = game?.status === 'lost';

  if (loadingGame) {
    return (
      <div className="flex items-center justify-center min-h-page">
        <TileLoader size={22} />
      </div>
    );
  }

  const resultText = game ? resultSentence(game.status, game.num_guesses) : '';
  const modeName = game ? MODES[game.mode]?.name ?? game.mode : '';
  const dateText = shortDate(game?.created_at);
  const subtitle = [resultText, modeName, dateText].filter(Boolean).join(' · ');
  const targetUpper = game?.target_word ? game.target_word.toUpperCase() : null;
  const gameContext = [targetUpper, resultText, modeName].filter(Boolean).join(' · ');
  const opener = (analysis?.opener_word || guesses[0] || '').toUpperCase();
  const resultStates: ('correct' | 'absent')[] = Array.from({ length: 5 }, () => (wonGame ? 'correct' : 'absent'));

  return (
    <div className="min-h-page bg-bg-base">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 h-[52px] bg-bg-base border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-full flex items-center gap-4">
          <button
            onClick={() => router.push('/play')}
            className="ink-link inline-flex items-center gap-1.5 font-mono text-label uppercase text-text-secondary hover:text-text-primary"
            aria-label="Back to play"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="hidden sm:inline">play</span>
          </button>

          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            {game?.target_word && <MiniTiles word={game.target_word} states={resultStates} size={22} />}
            {game && <Tag tone={wonGame ? 'green' : lostGame ? 'neutral' : 'neutral'}>{resultText}</Tag>}
            {modeName && <Tag className="hidden sm:inline-flex">{modeName}</Tag>}
          </div>

          <div className="relative">
            <button
              onClick={handleShare}
              className="ink-link inline-flex items-center gap-1.5 font-mono text-label uppercase text-text-secondary hover:text-text-primary"
              aria-label="Copy a link to this review"
            >
              <Share2 size={14} aria-hidden="true" />
              <span className="hidden sm:inline">share</span>
            </button>
            <AnimatePresence>
              {toastVisible && (
                <motion.span
                  key="toast"
                  role="status"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap pointer-events-none bg-bg-ink text-text-on-ink"
                  style={{ zIndex: 99 }}
                >
                  link copied
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Main column */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 pb-10 relative">
        <div className="max-w-[760px] mx-auto">
          {/* Header: title + plain result, Simple | Detailed on the right */}
          <header className="pt-8 mb-10 flex items-start justify-between gap-6 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Label className="block mb-2">game review</Label>
              <h1 className="font-display text-display-lg text-text-primary">Your game</h1>
              {game && <p className="mt-3 font-sans text-base text-text-secondary">{subtitle}</p>}
              {game && !detailed && (
                <div className="mt-3">
                  <GameMeta game={game} />
                </div>
              )}
            </div>
            <div className="flex flex-col items-end gap-4 shrink-0">
              <DetailToggle />
              {/* Navigator — Detailed only, on guess steps (the overview shows the real board) */}
              {detailed && analysis && !loadingAnalysis && currentStep !== 0 && (
                <NavigatorGrid guesses={guesses} patterns={boardPatterns} activeRow={activeRow} onRowClick={goToMoveRow} />
              )}
            </div>
          </header>

          {/* Analysis error */}
          {analysisError && (
            <div className="mb-10 bg-wash-accent px-5 py-5 flex flex-col gap-3 items-start">
              <p className="font-display text-display-sm text-text-primary">{analysisError}</p>
              <p className="font-sans text-sm text-text-secondary">The board is still here. Try again in a moment.</p>
              <Button variant="secondary" size="sm" onClick={runAnalysis}>
                Try again
              </Button>
            </div>
          )}

          {/* ───────── Simple view ───────── */}
          {!detailed && game && (
            <SimpleReview game={game} analysis={analysis} loading={loadingAnalysis} guesses={guesses} patterns={boardPatterns} />
          )}

          {/* ───────── Detailed view ───────── */}
          {detailed && loadingAnalysis && (
            <div className="flex flex-col gap-4" aria-busy="true">
              <Skeleton className="h-32" />
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-16" />
            </div>
          )}

          {detailed && game && !analysis && !loadingAnalysis && (
            <div className="grid md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7">
                <p className="font-display text-display-lg text-text-primary uppercase break-words">{game.target_word ?? '—'}</p>
              </div>
              <div className="md:col-span-5 flex md:justify-end">
                <Board guesses={guesses} patterns={boardPatterns} />
              </div>
            </div>
          )}

          {detailed && analysis && !loadingAnalysis && (
            <>
              {/* Step panels — internal scrolling so the page itself stays put */}
              <div className="relative" style={{ height: 'max(320px, calc(100dvh - 330px))' }}>
                {totalSteps > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={goPrev}
                      disabled={currentStep === 0}
                      aria-label="Previous step (←)"
                      className="hidden lg:inline-flex absolute -left-24 top-1/2 -translate-y-1/2 z-10 w-11 h-11 !px-0 bg-bg-base disabled:opacity-0 disabled:pointer-events-none"
                    >
                      <ChevronLeft size={18} aria-hidden="true" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={goNext}
                      disabled={currentStep === totalSteps - 1}
                      aria-label="Next step (→)"
                      className="hidden lg:inline-flex absolute -right-24 top-1/2 -translate-y-1/2 z-10 w-11 h-11 !px-0 bg-bg-base disabled:opacity-0 disabled:pointer-events-none"
                    >
                      <ChevronRight size={18} aria-hidden="true" />
                    </Button>
                  </>
                )}

                <div className="overflow-x-hidden h-full">
                  <AnimatePresence mode="wait" custom={stepDir}>
                    <motion.div
                      key={currentStep}
                      custom={stepDir}
                      initial={{ opacity: 0, x: stepDir > 0 ? 40 : -40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: stepDir > 0 ? -40 : 40 }}
                      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
                      className="h-full overflow-y-auto pr-1"
                      style={{ scrollbarGutter: 'stable' }}
                    >
                      {currentStep === 0 && (
                        <StepOverview
                          analysis={analysis}
                          activeRow={activeRow}
                          showExplanation={showExplanation}
                          setShowExplanation={setShowExplanation}
                          game={game}
                          guesses={guesses}
                          patterns={boardPatterns}
                          onRowClick={goToMoveRow}
                        />
                      )}
                      {currentStep >= 1 && currentStep <= moveCount && (
                        <GuessDetail
                          move={analysis.moves[currentStep - 1]}
                          targetWord={game?.target_word ?? null}
                          gameId={game?.id ?? null}
                          aiCacheRef={aiCacheRef}
                        />
                      )}
                      {currentStep === moveCount + 1 && <StepFinal game={game} analysis={analysis} />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Step indicator — thin ink segments, the active one in accent */}
              {totalSteps > 1 && (
                <div className="mt-4 flex justify-center items-center gap-1" role="tablist" aria-label="Review steps">
                  {Array.from({ length: totalSteps }).map((_, i) => {
                    const active = i === currentStep;
                    const label = i === 0 ? 'Overview' : i === moveCount + 1 ? 'Wrap-up' : `Guess ${i}`;
                    return (
                      <button
                        key={i}
                        role="tab"
                        aria-selected={active}
                        aria-label={label}
                        onClick={() => goToStep(i)}
                        className="group min-w-6 min-h-6 flex items-center py-2.5 px-0.5"
                      >
                        <span
                          className={clsx(
                            'block h-[2px] transition-[background-color,width] duration-med ease-ink',
                            active ? 'w-8 bg-accent' : 'w-5 bg-border-subtle group-hover:bg-border-default'
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Step counter + arrow controls */}
              {totalSteps > 1 && (
                <div className="mt-1 flex items-center justify-center gap-4">
                  <Button variant="secondary" size="sm" onClick={goPrev} disabled={currentStep === 0} aria-label="Previous step" className="w-9 !px-0">
                    <ChevronLeft size={16} aria-hidden="true" />
                  </Button>
                  <span className="font-mono text-xs tabular text-text-tertiary select-none">
                    {currentStep === 0 ? 'Overview' : currentStep === moveCount + 1 ? 'Wrap-up' : `Guess ${currentStep}`} · {currentStep + 1} / {totalSteps}
                  </span>
                  <Button variant="secondary" size="sm" onClick={goNext} disabled={currentStep === totalSteps - 1} aria-label="Next step" className="w-9 !px-0">
                    <ChevronRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* ───────── Ask the coach (both views) ───────── */}
          {game && analysis && (
            <section className="mt-16" aria-labelledby="coach-heading">
              <SectionHead
                eyebrow="coach"
                title={<span id="coach-heading">Ask the coach</span>}
                aside="Ask why a guess was costly, or what to open with next time."
              />
              <div className="mt-6 border-2 border-border-default h-[440px] flex flex-col">
                <CoachChat gameId={game.id} gameContext={gameContext} suggestions={coachPrompts(analysis)} />
              </div>
            </section>
          )}

          {/* ───────── What to do next ───────── */}
          {game && (
            <footer className="rule-top pt-6 mt-16 flex flex-col sm:flex-row gap-3 items-start">
              <ButtonLink href="/play" variant="primary" size="lg">
                Play again
              </ButtonLink>
              {opener && (
                <ButtonLink href={`/lab?word=${encodeURIComponent(opener)}`} variant="secondary" size="lg">
                  Try {opener} in the Word Lab
                </ButtonLink>
              )}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                               */
/* ------------------------------------------------------------------ */

export default function ReviewPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-page">
          <TileLoader size={22} />
        </div>
      }
    >
      <ReviewPage />
    </Suspense>
  );
}
