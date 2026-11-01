'use client';
/**
 * /u/[username] — the one profile page.
 *
 * Everyone sees the public profile (GET /profiles/:username, no auth needed).
 * When the viewer is the owner, the page also loads the private data the old
 * /dashboard fetched (games, rating history, stats — all behind auth) and
 * shows the owner-only sections: mode tabs, full game history with delete,
 * words that beat you, and how you play.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { AxiosError } from 'axios';
import TileSpinner from '@/components/TileSpinner';
import Toast from '@/components/Toast';
import InstallPrompt from '@/components/InstallPrompt';
import NemesisWords from '@/components/dashboard/NemesisWords';
import PaceHabits from '@/components/dashboard/PaceHabits';
import { profilesApi, errorMessage, type PublicProfile } from '@/lib/api';
import type { EloHistoryEntry } from '@/lib/types';
import { useAuth } from '@/lib/hooks/useAuth';
import { ButtonLink, Label, MiniTiles, SplitWords } from '@/components/ui';
import ProfileHeader from '../_components/ProfileHeader';
import AtAGlance from '../_components/AtAGlance';
import GuessesSection from '../_components/GuessesSection';
import GamesTable from '../_components/GamesTable';
import RecentGamesStrip from '../_components/RecentGamesStrip';
import NumbersBlock from '../_components/NumbersBlock';
import AchievementsStrip from '../_components/AchievementsStrip';
import { useOwnerData, type ModeFilter } from '../_components/useOwnerData';

/** Adapt the public profile's compact history to the shared sparkline. */
function toHistory(history: PublicProfile['elo_history']): EloHistoryEntry[] {
  const pts = history.filter((h) => Number.isFinite(h.elo));
  return pts.map((h, i) => ({
    elo_before: i === 0 ? h.elo : pts[i - 1].elo,
    elo_after: h.elo,
    delta: i === 0 ? 0 : Math.round(h.elo - pts[i - 1].elo),
    accuracy_score: null,
    recorded_at: h.at ?? new Date(0).toISOString(),
  }));
}

type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; profile: PublicProfile };

export default function ProfilePage() {
  const { username: rawUsername } = useParams<{ username: string }>();
  const username = decodeURIComponent(rawUsername ?? '');
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The public profile — re-requested once auth settles so the server can
  // tell us `is_me` (and serve a private profile to its owner).
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    setState({ kind: 'loading' });
    profilesApi
      .get(username)
      .then((res) => {
        if (!cancelled) setState({ kind: 'ready', profile: res.data });
      })
      .catch((err: AxiosError) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setState({ kind: 'missing' });
        else setState({ kind: 'error', message: errorMessage(err, 'Could not load this profile.') });
      });
    return () => {
      cancelled = true;
    };
  }, [username, authLoading]);

  useEffect(() => {
    const name = state.kind === 'ready' ? state.profile.username : username;
    document.title = `${name} · ELOquence`;
  }, [state, username]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2000);
  };

  const share = async () => {
    const url = window.location.href;
    const name = state.kind === 'ready' ? state.profile.username : username;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `${name} on ELOquence`, url });
        return;
      } catch {
        /* dismissed — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast('Profile link copied');
    } catch {
      showToast('Could not copy the link');
    }
  };

  if (state.kind === 'loading' || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-page">
        <TileSpinner size="md" label="Loading profile" />
      </div>
    );
  }

  if (state.kind === 'missing' || state.kind === 'error') {
    return (
      <div className="min-h-page flex items-center">
        <div className="w-full bg-wash-accent">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-7">
              <Label className="block mb-3">{state.kind === 'missing' ? 'profile · not found' : 'profile · error'}</Label>
              <SplitWords
                text={state.kind === 'missing' ? 'No one to see here.' : 'Something went wrong.'}
                as="h1"
                className="font-display text-display-lg text-text-primary"
              />
              <p className="text-base text-text-secondary mt-4 max-w-md">
                {state.kind === 'missing' ? 'This player is private or does not exist.' : state.message}
              </p>
              <ButtonLink href="/leaderboard" variant="secondary" size="md" className="mt-8">
                browse the leaderboard
              </ButtonLink>
            </div>
            <div className="md:col-span-5 md:justify-self-end" role="img" aria-label="Unknown player">
              <MiniTiles word="?????" states={['empty', 'empty', 'empty', 'empty', 'empty']} size={56} gap={6} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = !!user && (user.username === state.profile.username || state.profile.is_me);

  return (
    <>
      <ProfileBody profile={state.profile} isOwner={isOwner} onShare={share} />
      <Toast message={toast ?? ''} visible={toast !== null} />
    </>
  );
}

function ProfileBody({ profile, isOwner, onShare }: { profile: PublicProfile; isOwner: boolean; onShare: () => void }) {
  const [filter, setFilter] = useState<ModeFilter>('all');
  const owner = useOwnerData(isOwner, filter);
  const publicHistory = useMemo(() => toHistory(profile.elo_history), [profile.elo_history]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-12 md:gap-16">
      {isOwner && <InstallPrompt />}

      <ProfileHeader profile={profile} isOwner={isOwner} onShare={onShare} />

      <AtAGlance profile={profile} />

      <GuessesSection distribution={profile.guess_distribution} completed={profile.completed} wins={profile.wins} isOwner={isOwner} />

      {isOwner && <NemesisWords words={owner.stats?.nemesis_words} loading={owner.loadingStats} delay={0.05} />}

      {isOwner ? (
        <GamesTable
          games={owner.games}
          loading={owner.loadingGames}
          filter={filter}
          onFilter={setFilter}
          modeStats={owner.stats?.mode_stats}
          challengeCodeByWord={owner.challengeCodeByWord}
          deletingId={owner.deletingId}
          onDelete={owner.deleteGame}
        />
      ) : (
        <RecentGamesStrip games={profile.recent_games} username={profile.username} />
      )}

      <NumbersBlock
        history={isOwner ? owner.eloHistory : publicHistory}
        loadingHistory={isOwner && owner.loadingHistory}
        isOwner={isOwner}
        habits={
          isOwner ? (
            <PaceHabits
              pace={owner.stats?.pace ?? null}
              favouriteOpener={owner.stats?.favourite_opener}
              classificationMix={owner.stats?.classification_mix ?? null}
              loading={owner.loadingStats}
              delay={0.08}
            />
          ) : (
            <PaceHabits
              favouriteOpener={
                profile.favourite_opener ? { word: profile.favourite_opener, plays: profile.favourite_opener_plays, solve_rate: null } : null
              }
              delay={0.08}
              who="they"
            />
          )
        }
      />

      <AchievementsStrip achievements={profile.achievements} isOwner={isOwner} />
    </div>
  );
}
