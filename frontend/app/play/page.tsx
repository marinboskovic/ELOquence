'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Copy, HelpCircle } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { gamesApi, dailyApi, challengesApi, errorMessage } from '@/lib/api';
import { useSettings } from '@/lib/useSettings';
import { getRatingTier, patternToTiles, TileState } from '@/lib/types';
import { MODES, TERMS } from '@/lib/copy';
import TileSpinner from '@/components/TileSpinner';
import FirstTimeTutorial from '@/components/FirstTimeTutorial';
import Dialog from '@/components/Dialog';
import ModeRow from '@/components/play/ModeRow';
import { Button, Hint, Label, SplitWords, Tag, staggerParent } from '@/components/ui';

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
      next word in {timeLeft}
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
  // Daily is always unrated — only Ranked changes the rating
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

  // Refresh user data on mount so stats (games_played, rating, etc.) are current
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
      setError(errorMessage(err, 'Could not start the game. Please try again.'));
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
      setError('Could not create the link. Please try again.');
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

  // Brand-new: no Ranked games, no streak, and today's Daily untouched.
  // (games_played counts Ranked games only; the Daily shows through the streak
  // and today's cached patterns.)
  const isBrandNew = user
    ? user.games_played === 0 && user.current_streak === 0 && user.max_streak === 0 && !dailyAlreadyPlayed && !dailyPatterns
    : !dailyAlreadyPlayed && !dailyPatterns;

  // ── Friends link modal ───────────────────────────────────────────────────────
  const challengeModal = (
    <Dialog open={!!challengeCode} onClose={() => setChallengeCode(null)} title="Your Friends link" maxWidth="max-w-md">
      <div className="px-5 pb-5 pt-2 flex flex-col gap-5">
        <p className="text-sm text-text-secondary">Send this link. Everyone gets the same word.</p>

        <div className="rule-top pt-3">
          <Label className="block mb-2">link</Label>
          <div className="flex gap-2">
            <code className="flex-1 min-w-0 h-11 px-3 flex items-center border border-border-subtle bg-bg-elevated font-mono text-xs text-text-secondary truncate">
              {challengeUrl}
            </code>
            <Button variant="secondary" onClick={handleCopyChallengeLink} aria-label="Copy the link">
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
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );

  // ── Daily row content (shared by guest and user) ───────────────────────────────
  const dailyStatus = dailyAlreadyPlayed ? (
    <span className="flex flex-col md:items-end gap-0.5">
      <DailyCountdown onMidnight={handleMidnight} />
      <span className="text-text-primary">see your game</span>
    </span>
  ) : dailyPatterns ? (
    <span className="text-text-primary">continue</span>
  ) : null;

  // Rows are <button>s, so tags inside them stay plain text (no nested
  // <Hint> buttons); the header tag carries the explanation instead.
  const dailyTag = user?.current_streak ? (
    <Tag tone="ochre">{user.current_streak} day streak</Tag>
  ) : !dailyAlreadyPlayed ? (
    <Tag>today</Tag>
  ) : (
    <Tag tone="green">played</Tag>
  );

  const placementText = user?.is_placement ? `${TERMS.placement.name} · ${Math.min(user.games_played, 5)}/5` : null;
  const placementTag = placementText ? (
    <Tag tone="ochre">
      <Hint term="placement">{placementText}</Hint>
    </Tag>
  ) : null;
  const placementRowTag = placementText ? <Tag tone="ochre">{placementText}</Tag> : undefined;

  const signInStatus = <span>sign in to play</span>;

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
                <span className="flex items-baseline gap-2">
                  <Label>
                    <Hint term="rating">rating</Hint>
                  </Label>
                  <span className="font-display font-black text-display-md tabular text-text-primary">
                    {Math.round(user.elo_rating)}
                  </span>
                </span>
                {placementTag ?? <Tag dot={tier?.color}>{tier?.name}</Tag>}
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-text-secondary">{user.username}</span>
                {helpButton}
              </div>
            </>
          ) : (
            <>
              <p className="text-base text-text-secondary md:text-right max-w-xs">
                One word a day for everyone. Sign in for Ranked games.
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

      {/* ── New here? ── */}
      {isBrandNew && (
        <p className="mt-8 md:mt-10 pl-4 border-l-2 border-border-default text-base text-text-primary">
          <span className="font-semibold">New here?</span> Start with the Daily — same word for everyone, nothing at stake.
        </p>
      )}

      {/* ── Modes ── */}
      <motion.ul
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className={isBrandNew ? 'mt-6 md:mt-8 rule-top list-none m-0 p-0' : 'mt-10 md:mt-14 rule-top list-none m-0 p-0'}
        aria-label="Boards"
      >
        <ModeRow
          mode="daily"
          status={dailyStatus}
          tag={dailyTag}
          extra={dailyPatterns ? <MiniPatternGrid rows={dailyPatterns} /> : undefined}
          onClick={() => handleModeSelect('daily')}
          disabled={!!creating}
          loading={isDailyLoading}
        />

        <ModeRow
          mode="competitive"
          status={user ? null : signInStatus}
          tag={placementRowTag}
          onClick={() => handleModeSelect('competitive')}
          disabled={!!creating}
          loading={creating === 'competitive'}
          locked={!user}
        />

        <ModeRow
          mode="practice"
          status={user ? null : signInStatus}
          onClick={() => handleModeSelect('practice')}
          disabled={!!creating}
          loading={creating === 'practice'}
          locked={!user}
        />

        <ModeRow
          mode="challenge"
          status={user ? <span>get a link</span> : signInStatus}
          onClick={() => (user ? handleCreateChallenge() : router.push('/login'))}
          disabled={creatingChallenge || !!creating}
          loading={creatingChallenge}
          locked={!user}
        />
        <li className="rule-hair" aria-hidden="true" />
      </motion.ul>

      {/* ── Word Lab: a tool, not a board ── */}
      <p className="mt-6 text-sm text-text-secondary">
        Not sure what word to start with?{' '}
        <Link href="/lab" className="ink-link text-text-primary">
          Try one in the Word Lab
        </Link>
        .
      </p>

      {/* ── Guest: sign-in nudge ── */}
      {!user && (
        <div className="mt-12 md:mt-16 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <p className="md:col-span-8 font-display text-display-md text-text-primary">
            Sign in to play {MODES.competitive.name}, keep a streak and review every game.
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
