'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowUpRight, Check, Copy, HelpCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, dailyApi, challengesApi, errorMessage } from '@/lib/api';
import { useSettings } from '@/lib/useSettings';
import { getRatingTier, patternToTiles, TileState } from '@/lib/types';
import TileSpinner from '@/components/TileSpinner';
import FirstTimeTutorial from '@/components/FirstTimeTutorial';
import Dialog from '@/components/Dialog';
import { Button, Label, SplitWords, Tag, staggerParent, staggerChild } from '@/components/ui';
import clsx from 'clsx';

/** Returns ms until local midnight (server TZ matches client TZ). */
function msUntilMidnight(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

function DailyCountdown({ onMidnight }: { onMidnight?: () => void }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const diff = msUntilMidnight();
      if (diff <= 0) {
        onMidnight?.();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [onMidnight]);

  return (
    <span className="font-mono text-xs tabular text-text-secondary">
      next in {timeLeft}
    </span>
  );
}

/** Today's pattern grid, drawn with the tile vars so themes apply. */
function MiniPatternGrid({ rows }: { rows: TileState[][] }) {
  return (
    <div role="img" className="flex flex-col gap-[3px]" aria-label={`Today's game: ${rows.length} ${rows.length === 1 ? 'guess' : 'guesses'}`}>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[3px]">
          {row.map((state, j) => (
            <span
              key={j}
              className="block w-3.5 h-3.5"
              style={{ backgroundColor: `var(--tile-${state === 'empty' || state === 'tbd' ? 'absent' : state})` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toLowerCase();
}

/* ── Mode row ─────────────────────────────────────────────────────────────── */

interface ModeRowProps {
  title: string;
  copy: string;
  status: React.ReactNode;
  tag?: React.ReactNode;
  extra?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  locked?: boolean;
}

function ModeRow({ title, copy, status, tag, extra, onClick, disabled, loading, locked }: ModeRowProps) {
  return (
    <motion.li variants={staggerChild} className="rule-hair">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={loading || undefined}
        className={clsx(
          'group w-full text-left grid grid-cols-1 md:grid-cols-12 items-center gap-x-6 gap-y-3 py-7 md:py-8',
          'disabled:cursor-wait',
          locked && 'opacity-70 hover:opacity-100'
        )}
      >
        {/* Display label */}
        <div className="md:col-span-5 flex items-center gap-4 min-w-0">
          <span className="font-display text-display-md text-text-primary transition-transform duration-fast ease-out group-hover:-translate-y-0.5">
            {title}
          </span>
          {tag}
        </div>

        {/* Copy + extra (pattern grid) */}
        <div className="md:col-span-4 flex items-center gap-5 min-w-0">
          {extra}
          <p className="text-sm text-text-secondary leading-snug">{copy}</p>
        </div>

        {/* Status + arrow */}
        <div className="md:col-span-3 flex items-center md:justify-end gap-3 min-w-0">
          <span className="font-mono text-xs tabular text-text-secondary text-left md:text-right truncate">
            {loading ? <TileSpinner size="sm" label="Starting" /> : status}
          </span>
          <ArrowRight
            size={18}
            className="shrink-0 text-text-tertiary transition-[color,transform] duration-fast ease-out group-hover:text-accent group-hover:translate-x-1"
            aria-hidden="true"
          />
        </div>
      </button>
    </motion.li>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function PlayPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [settings] = useSettings();
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [challengeCode, setChallengeCode] = useState<string | null>(null);
  const [challengeCopied, setChallengeCopied] = useState(false);
  const [dailyAlreadyPlayed, setDailyAlreadyPlayed] = useState(false);
  // Daily is always unrated — only competitive affects ELO
  const [dailyGameId, setDailyGameId] = useState<string | null>(null);
  const [dailyPatterns, setDailyPatterns] = useState<TileState[][] | null>(null);
  const [dailyRefreshKey, setDailyRefreshKey] = useState(0);
  // Bumped by the "?" help button to (re)open the how-to-play tutorial.
  const [helpSignal, setHelpSignal] = useState(0);

  const tier = user ? getRatingTier(user.elo_rating) : null;

  // Reset daily state at midnight so a new puzzle appears automatically
  const handleMidnight = useCallback(() => {
    setDailyAlreadyPlayed(false);
    setDailyGameId(null);
    setDailyPatterns(null);
    setDailyRefreshKey((k) => k + 1);
  }, []);

  // Schedule a midnight refresh even when the countdown isn't visible
  useEffect(() => {
    const timer = setTimeout(handleMidnight, msUntilMidnight());
    return () => clearTimeout(timer);
  }, [handleMidnight, dailyRefreshKey]);

  // Refresh user data on mount so stats (games_played, ELO, etc.) are current
  useEffect(() => {
    refreshUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch user + daily status when the tab/page becomes visible again
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
        setDailyRefreshKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshUser]);

  // Check if daily was already completed (as guest via localStorage, or as user via API)
  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (user) {
      // Paint from cache immediately to avoid a flash, then always refresh
      // from the API so the row reflects the latest move count (e.g.,
      // after a 6th guess submitted from the game page).
      const savedPatterns = localStorage.getItem(`eloquence_daily_patterns_${today}`);
      if (savedPatterns) {
        try {
          const nums: number[] = JSON.parse(savedPatterns);
          setDailyPatterns(nums.map((p) => patternToTiles(p)));
        } catch { /* ignore, API will populate */ }
      }

      dailyApi.get().then(async (res) => {
        if (res.data.already_played) {
          setDailyAlreadyPlayed(true);
          const gameId = res.data.existing_game_id;
          if (gameId) {
            setDailyGameId(gameId);
            try {
              const gameRes = await gamesApi.get(gameId);
              const moves = gameRes.data.moves || [];
              if (moves.length > 0) {
                const sorted = [...moves].sort((a: { move_number: number }, b: { move_number: number }) => a.move_number - b.move_number);
                const pats = sorted.map((m: { pattern: number }) => patternToTiles(m.pattern));
                setDailyPatterns(pats);
                localStorage.setItem(
                  `eloquence_daily_patterns_${today}`,
                  JSON.stringify(sorted.map((m: { pattern: number }) => m.pattern)),
                );
              } else {
                setDailyPatterns(null);
                localStorage.removeItem(`eloquence_daily_patterns_${today}`);
              }
            } catch { /* ignore — keep cached paint */ }
          }
        } else {
          setDailyAlreadyPlayed(false);
          setDailyGameId(null);
          setDailyPatterns(null);
          // Clear any stale per-date cache so old patterns don't bleed through
          localStorage.removeItem(`eloquence_daily_patterns_${today}`);
        }
      }).catch(() => {
        // Ignore
      });
    } else {
      const guestPlayed = localStorage.getItem(`eloquence_daily_played_${today}`) === 'true';
      const savedPatterns = localStorage.getItem(`eloquence_daily_patterns_${today}`);
      const savedGameId = localStorage.getItem(`eloquence_daily_game_id_${today}`);

      if (savedPatterns) {
        try {
          const nums: number[] = JSON.parse(savedPatterns);
          setDailyPatterns(nums.map((p) => patternToTiles(p)));
        } catch { /* ignore */ }
      }
      if (savedGameId) {
        setDailyGameId(savedGameId);
      }
      if (guestPlayed) {
        setDailyAlreadyPlayed(true);
      }
    }
  }, [user, dailyRefreshKey]);

  const handleModeSelect = async (modeId: string) => {
    if (creating) return;
    setError('');

    if ((modeId === 'competitive' || modeId === 'practice') && !user) {
      router.push('/login');
      return;
    }

    if (modeId === 'daily' && (dailyAlreadyPlayed || dailyGameId)) {
      if (user) {
        setCreating(modeId);
        try {
          const res = await dailyApi.play();
          const gid = res.data.id || res.data.game_id;
          if (gid) router.push(`/game/${gid}`);
        } catch { /* ignore */ }
        setCreating(null);
        return;
      } else if (dailyGameId) {
        router.push(`/game/${dailyGameId}`);
        return;
      }
    }

    setCreating(modeId);
    try {
      let gameId: string;

      if (modeId === 'daily') {
        const res = user
          ? await dailyApi.play()
          : await dailyApi.guest();
        gameId = res.data.id || res.data.game_id;
        if (res.data.status && res.data.status !== 'in_progress') {
          router.push(`/review/${gameId}`);
          return;
        }
      } else {
        const res = await gamesApi.create({
          mode: modeId,
          word_pool: modeId === 'competitive' ? 'competitive' : 'standard',
          hard_mode: settings.hardMode,
        });
        gameId = res.data.id;
      }

      router.push(`/game/${gameId}`);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not start game. Please try again.'));
      setCreating(null);
    }
  };

  // PWA shortcuts: `/play?mode=daily|practice|competitive` auto-starts that
  // mode once auth has resolved. Read from window.location in an effect
  // (not useSearchParams) to avoid the CSR bailout; fires at most once.
  const autoStartedRef = useRef(false);
  const handleModeSelectRef = useRef(handleModeSelect);
  handleModeSelectRef.current = handleModeSelect;
  useEffect(() => {
    if (loading || autoStartedRef.current) return;
    if (typeof window === 'undefined') return;
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode !== 'daily' && mode !== 'practice' && mode !== 'competitive') return;
    autoStartedRef.current = true;
    // Drop the param so a back-navigation to /play doesn't re-trigger.
    window.history.replaceState(null, '', '/play');
    if (mode !== 'daily' && !user) {
      router.push(`/login?next=${encodeURIComponent(`/play?mode=${mode}`)}`);
      return;
    }
    void handleModeSelectRef.current(mode);
  }, [loading, user, router]);

  const handleCreateChallenge = async () => {
    if (!user || creatingChallenge) return;
    setCreatingChallenge(true);
    setError('');
    try {
      const res = await challengesApi.create();
      setChallengeCode(res.data.code);
    } catch {
      setError('Could not create challenge. Please try again.');
    } finally {
      setCreatingChallenge(false);
    }
  };

  const handleCopyChallengeLink = async () => {
    if (!challengeCode) return;
    const url = `${window.location.origin}/challenge/${challengeCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setChallengeCopied(true);
      setTimeout(() => setChallengeCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-page">
        <TileSpinner size="lg" label="Loading" />
      </div>
    );
  }

  const isDailyLoading = creating === 'daily';
  const challengeUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/challenge/${challengeCode}` : `/challenge/${challengeCode}`;

  // ── Challenge modal ───────────────────────────────────────────────────────────
  const challengeModal = (
    <Dialog open={!!challengeCode} onClose={() => setChallengeCode(null)} title="Challenge created" maxWidth="max-w-md">
      <div className="px-5 pb-5 pt-2 flex flex-col gap-5">
        <p className="text-sm text-text-secondary">Share the link. Everyone who plays it gets the same word.</p>

        <div className="rule-top pt-3">
          <Label className="block mb-2">link</Label>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 h-11 px-3 flex items-center border border-border-subtle bg-bg-elevated font-mono text-xs text-text-secondary truncate">
              {challengeUrl}
            </code>
            <Button variant="secondary" onClick={handleCopyChallengeLink} aria-label="Copy challenge link">
              {challengeCopied ? <Check size={13} /> : <Copy size={13} />}
              {challengeCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button size="lg" onClick={() => router.push(`/challenge/${challengeCode}`)} className="w-full">
            Play it yourself first
            <ArrowRight size={14} />
          </Button>
          <Button variant="ghost" onClick={() => setChallengeCode(null)}>
            Dismiss
          </Button>
        </div>
      </div>
    </Dialog>
  );

  // ── Daily row content (shared by guest and user) ───────────────────────────────
  const dailyStatus = dailyAlreadyPlayed ? (
    <span className="flex flex-col md:items-end gap-0.5">
      <DailyCountdown onMidnight={handleMidnight} />
      <span className="text-text-primary">view your game</span>
    </span>
  ) : dailyPatterns ? (
    <span className="text-text-primary">continue</span>
  ) : (
    <span>free · unrated</span>
  );

  const dailyTag = user?.current_streak ? (
    <Tag tone="ochre">{user.current_streak} day streak</Tag>
  ) : !dailyAlreadyPlayed ? (
    <Tag>today</Tag>
  ) : (
    <Tag tone="green">played</Tag>
  );

  const helpButton = (
    <Button size="sm" variant="secondary" onClick={() => setHelpSignal((s) => s + 1)} aria-label="How to play" title="How to play">
      <HelpCircle size={13} />
      how to play
    </Button>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* ── Head ── */}
      <header className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-end">
        <div className="md:col-span-7">
          <Label className="block mb-3">play · {todayLabel()}</Label>
          <SplitWords text="Pick a board." as="h1" className="font-display text-display-lg text-text-primary" />
        </div>

        <div className="md:col-span-5 flex flex-col md:items-end gap-3">
          {user ? (
            <>
              <div className="flex items-baseline gap-3 flex-wrap md:justify-end">
                <span className="font-display font-black text-display-md tabular text-text-primary">
                  {Math.round(user.elo_rating)}
                </span>
                <Tag tone={user.is_placement ? 'ochre' : 'neutral'} dot={tier?.color}>
                  {user.is_placement ? `placement ${user.games_played}/5` : tier?.name}
                </Tag>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-text-secondary">{user.username}</span>
                {helpButton}
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-text-secondary md:text-right max-w-xs">
                One word a day for everyone. Sign in for rated games.
              </p>
              {helpButton}
            </>
          )}
        </div>
      </header>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 px-4 py-3 bg-wash-accent text-sm text-text-primary border-l-2"
            style={{ borderColor: 'var(--red)' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* ── Modes ── */}
      <motion.ul
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="mt-10 md:mt-14 rule-top list-none m-0 p-0"
        aria-label="Game modes"
      >
        <ModeRow
          title="Daily"
          copy={user ? 'One word per day. Play against the community.' : 'One word per day, shared across the community. No account needed.'}
          status={dailyStatus}
          tag={dailyTag}
          extra={dailyPatterns ? <MiniPatternGrid rows={dailyPatterns} /> : undefined}
          onClick={() => handleModeSelect('daily')}
          disabled={!!creating}
          loading={isDailyLoading}
        />

        <ModeRow
          title="Competitive"
          copy="Random words from the full pool. Every result moves your rating."
          status={user ? `rated · ±elo` : 'rated · sign in'}
          tag={user?.is_placement ? <Tag tone="ochre">placement {user.games_played}/5</Tag> : user ? <Tag tone="ink">rated</Tag> : <Tag>locked</Tag>}
          onClick={() => handleModeSelect('competitive')}
          disabled={!!creating}
          loading={creating === 'competitive'}
          locked={!user}
        />

        <ModeRow
          title="Practice"
          copy="The same words, no stakes. Nothing is recorded against your rating."
          status={user ? 'unrated' : 'unrated · sign in'}
          tag={!user ? <Tag>locked</Tag> : undefined}
          onClick={() => handleModeSelect('practice')}
          disabled={!!creating}
          loading={creating === 'practice'}
          locked={!user}
        />

        <ModeRow
          title="Challenge"
          copy="Pick a word for a friend. Same word, separate boards, one leaderboard."
          status={user ? 'friends · link' : 'friends · sign in'}
          tag={!user ? <Tag>locked</Tag> : undefined}
          onClick={() => (user ? handleCreateChallenge() : router.push('/login'))}
          disabled={creatingChallenge || !!creating}
          loading={creatingChallenge}
          locked={!user}
        />

        {/* Opener Lab — a tool, not a mode: a quieter secondary row */}
        <motion.li variants={staggerChild} className="rule-hair">
          <Link
            href="/lab"
            className="group grid grid-cols-1 md:grid-cols-12 items-center gap-x-6 gap-y-1 py-5"
          >
            <span className="md:col-span-5 flex items-center gap-3">
              <span className="font-display font-bold text-display-sm text-text-primary transition-transform duration-fast ease-out group-hover:-translate-y-0.5">
                Opener Lab
              </span>
              <Tag>tool</Tag>
            </span>
            <span className="md:col-span-4 text-sm text-text-secondary">
              See how any opener splits the word list. No account needed.
            </span>
            <span className="md:col-span-3 flex items-center md:justify-end gap-3 font-mono text-xs text-text-secondary">
              entropy · bits
              <ArrowUpRight
                size={16}
                className="text-text-tertiary transition-[color,transform] duration-fast ease-out group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                aria-hidden="true"
              />
            </span>
          </Link>
        </motion.li>
        <li className="rule-hair" aria-hidden="true" />
      </motion.ul>

      {/* ── Guest: sign-in nudge ── */}
      {!user && (
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <p className="md:col-span-8 font-display text-display-md text-text-primary">
            Sign in to play rated, keep a streak and review every game.
          </p>
          <div className="md:col-span-4 flex md:justify-end">
            <Button size="lg" onClick={() => router.push('/login')}>
              Sign in
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {challengeModal}
      <FirstTimeTutorial openSignal={helpSignal} />
    </div>
  );
}
