'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import { Pencil, Share2 } from 'lucide-react';
import TileSpinner from '@/components/TileSpinner';
import Toast from '@/components/Toast';
import GuessDistribution from '@/components/GuessDistribution';
import EloSparkline from '@/components/EloSparkline';
import { ACHIEVEMENT_META } from '@/components/AchievementToast';
import { profilesApi, errorMessage, PublicProfile } from '@/lib/api';
import { getRatingTier, type EloHistoryEntry } from '@/lib/types';
import {
  Button,
  ButtonLink,
  Label,
  MiniTiles,
  PatternRow,
  Reveal,
  SplitWords,
  Stat,
  Tag,
  staggerChild,
  staggerParent,
} from '@/components/ui';
import clsx from 'clsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────
type TierTone = 'neutral' | 'ochre' | 'green' | 'ink';
function tierTone(name: string): TierTone {
  if (name === 'Veteran') return 'ochre';
  if (name === 'Master') return 'green';
  if (name === 'Grandmaster') return 'ink';
  return 'neutral';
}

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

// ─── Recent game card ─────────────────────────────────────────────────────────
function GameCard({ game }: { game: PublicProfile['recent_games'][number] }) {
  const won = game.status === 'won';
  const lost = game.status === 'lost';
  const score = won ? `${game.num_guesses}/6` : lost ? 'X' : '—';
  const delta = game.elo_delta;
  const rows = game.patterns.length ? game.patterns : [];
  return (
    <motion.div
      variants={staggerChild}
      className="shrink-0 w-[92px] border-2 border-border-default bg-bg-base p-2.5 flex flex-col gap-2 transition-all duration-fast hover:shadow-ink hover:-translate-x-0.5 hover:-translate-y-0.5"
      title={`${game.mode}${game.hard_mode ? ' · hard mode' : ''} · ${won ? `won in ${game.num_guesses}` : lost ? 'lost' : game.status}`}
    >
      <div className="flex flex-col justify-end" style={{ gap: 2, minHeight: 6 * 12 }}>
        {rows.map((p, i) => (
          <PatternRow key={i} pattern={p} size={10} gap={2} />
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-1">
        <span className={clsx('font-display font-bold text-base tabular', won ? 'text-text-primary' : 'text-text-secondary')}>
          {score}
          {game.hard_mode && <span className="text-text-tertiary">*</span>}
        </span>
        <span
          className={clsx('font-mono text-[10px] tabular', delta == null ? 'text-text-ghost' : delta >= 0 ? 'text-accent' : 'text-text-tertiary')}
        >
          {delta == null ? '·' : `${delta >= 0 ? '+' : ''}${Math.round(delta)}`}
        </span>
      </div>
      <Label className="text-text-tertiary">{game.mode}</Label>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type LoadState = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready'; profile: PublicProfile };

export default function PublicProfilePage() {
  const { username: rawUsername } = useParams<{ username: string }>();
  const username = decodeURIComponent(rawUsername ?? '');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
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
  }, [username]);

  useEffect(() => {
    const name = state.kind === 'ready' ? state.profile.username : username;
    document.title = `${name} · ELOquence`;
  }, [state, username]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

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

  if (state.kind === 'loading') {
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
                browse the ladder
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

  return (
    <>
      <ProfileBody profile={state.profile} onShare={share} />
      <Toast message={toast ?? ''} visible={toast !== null} />
    </>
  );
}

function ProfileBody({ profile, onShare }: { profile: PublicProfile; onShare: () => void }) {
  const tier = getRatingTier(profile.elo_rating);
  const initial = profile.username.trim().charAt(0).toUpperCase() || '?';
  const memberSince = profile.member_since
    ? new Date(profile.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase()
    : null;
  const losses = Math.max(0, profile.completed - profile.wins);
  const achievements = useMemo(
    () =>
      [...profile.achievements].sort((a, b) => {
        const ta = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
        const tb = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
        return tb - ta;
      }),
    [profile.achievements]
  );
  const history = useMemo(() => toHistory(profile.elo_history), [profile.elo_history]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-12 md:gap-16">
      {/* ── Masthead ────────────────────────────────────────────────────── */}
      <header aria-label="Player" className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-end">
        <div className="md:col-span-8 flex items-end gap-5 min-w-0">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={72}
              height={72}
              referrerPolicy="no-referrer"
              className="w-14 h-14 md:w-[72px] md:h-[72px] object-cover shrink-0 border-2 border-border-default"
            />
          ) : (
            <div
              className="w-14 h-14 md:w-[72px] md:h-[72px] shrink-0 bg-bg-ink text-text-on-ink flex items-center justify-center font-display font-black text-3xl select-none"
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <Label className="block mb-2">profile{profile.is_me ? ' · you' : ''}</Label>
            <SplitWords text={profile.username} as="h1" className="font-display text-display-lg text-text-primary break-words" />
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <Tag tone={tierTone(tier.name)}>{tier.name}</Tag>
              {profile.is_placement && <Tag tone="ochre">placement {Math.min(profile.rated_games, 5)}/5</Tag>}
              {memberSince && <span className="font-mono text-xs text-text-tertiary tabular">since {memberSince}</span>}
            </div>
          </div>
        </div>

        <div className="md:col-span-4 flex items-center gap-2 md:justify-end">
          {profile.is_me && (
            <ButtonLink href="/settings" variant="secondary" size="sm">
              <Pencil size={13} />
              edit
            </ButtonLink>
          )}
          <Button type="button" variant="primary" size="sm" onClick={onShare}>
            <Share2 size={13} />
            share
          </Button>
        </div>
      </header>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <section aria-label="Player statistics" className="rule-top pt-1 grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-6">
        <Stat label="rating" value={Math.round(profile.elo_rating)} sub={`${profile.rated_games} rated game${profile.rated_games === 1 ? '' : 's'}`} />
        <Stat label="peak" value={Math.round(profile.peak_elo)} />
        <Stat label="win rate" value={`${Math.round(profile.win_rate)}%`} sub={`${profile.wins} of ${profile.completed}`} />
        <Stat label="avg guesses" value={profile.avg_guesses != null ? profile.avg_guesses.toFixed(2) : '—'} sub="per win" />
        <Stat
          label="accuracy"
          value={profile.avg_accuracy != null ? `${Math.round(profile.avg_accuracy)}%` : '—'}
          sub={profile.best_accuracy != null ? `best ${Math.round(profile.best_accuracy)}%` : undefined}
        />
        <Stat label="streak" value={profile.current_streak} sub={`max ${profile.max_streak}`} />
      </section>

      {/* ── Distribution + rating line (7/5) ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
        <Reveal as="section" aria-label="Guess distribution" className="md:col-span-7 min-w-0">
          <div className="rule-top pt-3 flex items-end justify-between gap-4">
            <div>
              <Label className="block mb-1">distribution</Label>
              <h2 className="font-display text-display-sm text-text-primary">Guesses to solve</h2>
            </div>
            {profile.completed > 0 && <span className="font-mono text-xs tabular text-text-tertiary">{profile.completed} games</span>}
          </div>
          <div className="mt-4">
            {profile.completed > 0 ? (
              <GuessDistribution distribution={profile.guess_distribution} losses={losses} />
            ) : (
              <p className="text-sm text-text-secondary">No completed games yet.</p>
            )}
          </div>
        </Reveal>

        <div className="md:col-span-5 min-w-0 flex flex-col gap-10">
          <Reveal as="section" delay={0.08} aria-label="Rating history">
            <div className="rule-top pt-3 flex items-end justify-between gap-4">
              <div>
                <Label className="block mb-1">rating</Label>
                <h2 className="font-display text-display-sm text-text-primary">Rated games</h2>
              </div>
              {history.length > 1 && <span className="font-mono text-xs tabular text-text-tertiary">last {history.length}</span>}
            </div>
            <div className="mt-4">
              {history.length >= 2 ? (
                <EloSparkline data={history} height={160} />
              ) : (
                <p className="text-sm text-text-secondary">Not enough rated games yet.</p>
              )}
            </div>
          </Reveal>

          <Reveal as="section" delay={0.14} aria-label="Favourite opener">
            <div className="rule-top pt-3">
              <Label className="block mb-1">favourite opener</Label>
            </div>
            <div className="mt-3">
              {profile.favourite_opener ? (
                <div className="flex items-center gap-4 flex-wrap">
                  <MiniTiles word={profile.favourite_opener.toUpperCase().slice(0, 5)} size={26} />
                  <span className="text-sm text-text-secondary">
                    played <span className="font-mono tabular text-text-primary font-semibold">{profile.favourite_opener_plays}</span> time
                    {profile.favourite_opener_plays === 1 ? '' : 's'}
                  </span>
                  <Link
                    href={`/lab?word=${encodeURIComponent(profile.favourite_opener)}`}
                    className="ink-link ml-auto font-mono text-label uppercase text-text-primary"
                  >
                    analyse →
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No opener yet.</p>
              )}
            </div>
          </Reveal>
        </div>
      </div>

      {/* ── Recent games ────────────────────────────────────────────────── */}
      <Reveal as="section" aria-label="Recent games">
        <div className="rule-top pt-3 flex items-end justify-between gap-4">
          <div>
            <Label className="block mb-1">recent</Label>
            <h2 className="font-display text-display-md text-text-primary">Last games</h2>
          </div>
          {profile.recent_games.length > 0 && <span className="font-mono text-label uppercase text-text-tertiary">* hard mode</span>}
        </div>
        {profile.recent_games.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">Nothing played yet.</p>
        ) : (
          <div className="mt-5 -mx-4 px-4 md:-mx-8 md:px-8 overflow-x-auto hide-native-scrollbar">
            <motion.div className="flex gap-3 pb-2 pr-2 w-max" variants={staggerParent} initial="hidden" animate="show">
              {profile.recent_games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </motion.div>
          </div>
        )}
      </Reveal>

      {/* ── Achievements ────────────────────────────────────────────────── */}
      <Reveal as="section" aria-label="Achievements">
        <div className="rule-top pt-3 flex items-end justify-between gap-4">
          <div>
            <Label className="block mb-1">achievements</Label>
            <h2 className="font-display text-display-md text-text-primary">Unlocked</h2>
          </div>
          {achievements.length > 0 && <span className="font-mono text-xs tabular text-text-tertiary">{achievements.length}</span>}
        </div>
        {achievements.length === 0 ? (
          <p className="mt-4 text-sm text-text-secondary">No achievements yet.</p>
        ) : (
          <motion.ul className="mt-4 flex flex-wrap gap-2" role="list" variants={staggerParent} initial="hidden" animate="show">
            {achievements.map((a) => {
              const meta = ACHIEVEMENT_META[a.type];
              const unlocked = a.unlocked_at
                ? new Date(a.unlocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : null;
              return (
                <motion.li key={a.type} variants={staggerChild}>
                  <Tag tone="neutral" className="!h-7 !text-[11px] text-text-primary border-border-default" >
                    <span title={[meta?.description, unlocked ? `Unlocked ${unlocked}` : null].filter(Boolean).join(' · ')}>
                      {meta?.name ?? a.type.replace(/_/g, ' ')}
                    </span>
                  </Tag>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </Reveal>
    </div>
  );
}
