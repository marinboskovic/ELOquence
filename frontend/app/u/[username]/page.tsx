'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import { Award, Flame, Pencil, Share2, TrendingUp, BarChart2, History } from 'lucide-react';
import Tile from '@/components/Tile';
import TileSpinner from '@/components/TileSpinner';
import Toast from '@/components/Toast';
import GuessDistribution from '@/components/GuessDistribution';
import { ACHIEVEMENT_META } from '@/components/AchievementToast';
import { profilesApi, errorMessage, PublicProfile } from '@/lib/api';
import { getRatingTier, patternToTiles, TileState } from '@/lib/types';
import { springs } from '@/lib/animations';
import clsx from 'clsx';

// ─── Small pieces ─────────────────────────────────────────────────────────────
const TILE_FILL: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent:  'var(--tile-absent)',
  empty:   'var(--tile-empty-bg)',
  tbd:     'var(--tile-empty-bg)',
};

function PatternRow({ pattern, size = 10 }: { pattern: number; size?: number }) {
  const tiles = patternToTiles(pattern);
  return (
    <div className="flex" style={{ gap: 2 }} aria-hidden="true">
      {tiles.map((s, i) => (
        <span key={i} className="block rounded-sm" style={{ width: size, height: size, backgroundColor: TILE_FILL[s] }} />
      ))}
    </div>
  );
}

function MiniWord({ word, size = 26 }: { word: string; size?: number }) {
  return (
    <div className="flex" style={{ gap: 3 }} aria-label={word}>
      {word.split('').map((ch, i) => (
        <span
          key={i}
          className="flex items-center justify-center rounded-sm font-sans font-bold uppercase select-none"
          style={{ width: size, height: size, backgroundColor: 'var(--tile-correct)', color: '#ffffff', fontSize: Math.round(size * 0.55), lineHeight: 1 }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
}

function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx('font-sans text-[10px] uppercase tracking-wider text-text-secondary font-semibold', className)}>{children}</span>;
}

function StatTile({ label, value, sub, accent, delay = 0 }: { label: string; value: string; sub?: string; accent?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-2 p-4 rounded-card bg-bg-base border border-border-default min-w-0"
    >
      <MicroLabel>{label}</MicroLabel>
      <span className="font-display font-black tracking-tight text-2xl tabular-nums leading-none truncate" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub && <span className="font-sans text-[11px] text-text-tertiary leading-tight truncate">{sub}</span>}
    </motion.div>
  );
}

function Card({ title, icon, aside, children, className }: { title: string; icon?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={clsx('rounded-card-lg bg-bg-elevated border border-border-subtle p-5', className)} aria-label={title}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {icon && <span className="text-text-ghost">{icon}</span>}
          <span className="font-sans font-semibold text-sm text-text-primary">{title}</span>
        </div>
        {aside && <span className="font-sans text-[11px] text-text-ghost font-mono tabular-nums text-right">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

// ─── ELO sparkline (plain inline SVG) ─────────────────────────────────────────
function EloLine({ history }: { history: PublicProfile['elo_history'] }) {
  const pts = history.map((h) => h.elo).filter((n) => Number.isFinite(n));
  if (pts.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 font-sans text-sm text-text-secondary">Not enough rated games yet</div>
    );
  }
  const W = 320;
  const H = 96;
  const PAD = 6;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, max - min);
  const x = (i: number) => PAD + (i / (pts.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const d = pts.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const first = pts[0];
  const delta = Math.round(last - first);

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24" role="img" aria-label={`Rating over the last ${pts.length} rated games, from ${Math.round(first)} to ${Math.round(last)}`}>
        <line x1={PAD} x2={W - PAD} y1={y(min)} y2={y(min)} stroke="var(--border-subtle)" strokeWidth={1} />
        <line x1={PAD} x2={W - PAD} y1={y(max)} y2={y(max)} stroke="var(--border-subtle)" strokeWidth={1} />
        <motion.polyline
          points={d}
          fill="none"
          stroke="var(--tile-correct)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <circle cx={x(pts.length - 1)} cy={y(last)} r={3.5} fill="var(--tile-correct)" stroke="var(--bg-elevated)" strokeWidth={2} />
      </svg>
      <div className="flex items-center justify-between font-mono text-[11px] tabular-nums text-text-secondary">
        <span>
          low <span className="text-text-primary">{Math.round(min)}</span>
        </span>
        <span style={{ color: delta >= 0 ? 'var(--tile-correct)' : 'var(--red)' }}>
          {delta >= 0 ? '+' : ''}
          {delta} over {pts.length} games
        </span>
        <span>
          high <span className="text-text-primary">{Math.round(max)}</span>
        </span>
      </div>
    </div>
  );
}

// ─── Recent game column ───────────────────────────────────────────────────────
function GameColumn({ game, index }: { game: PublicProfile['recent_games'][number]; index: number }) {
  const won = game.status === 'won';
  const lost = game.status === 'lost';
  const score = won ? `${game.num_guesses}/6` : lost ? 'X/6' : '—';
  const delta = game.elo_delta;
  const rows = game.patterns.length ? game.patterns : [];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.25 }}
      className="flex flex-col items-center gap-1.5 shrink-0 w-[76px] px-2 py-2.5 rounded-card bg-bg-base border border-border-subtle"
      title={`${game.mode}${game.hard_mode ? ' · hard mode' : ''} · ${won ? `won in ${game.num_guesses}` : lost ? 'lost' : game.status}`}
    >
      <div className="flex flex-col justify-end" style={{ gap: 2, minHeight: 6 * 12 }}>
        {rows.map((p, i) => (
          <PatternRow key={i} pattern={p} size={10} />
        ))}
      </div>
      <span className={clsx('font-mono text-xs font-bold tabular-nums', won ? 'text-text-primary' : 'text-text-secondary')}>
        {score}
        {game.hard_mode && <span className="text-text-secondary">*</span>}
      </span>
      <span className="font-sans text-[10px] text-text-ghost capitalize leading-none">{game.mode}</span>
      <span
        className="font-mono text-[10px] tabular-nums font-semibold leading-none"
        style={{ color: delta == null ? 'var(--text-ghost)' : delta >= 0 ? 'var(--tile-correct)' : 'var(--red)' }}
      >
        {delta == null ? '·' : `${delta >= 0 ? '+' : ''}${Math.round(delta)}`}
      </span>
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
      <div className="flex items-center justify-center min-h-[calc(100dvh-52px)]">
        <TileSpinner size="md" label="Loading profile" />
      </div>
    );
  }

  if (state.kind === 'missing' || state.kind === 'error') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
        <div className="flex" style={{ gap: 'var(--tile-gap)' }} role="img" aria-label="Unknown player">
          {Array.from({ length: 5 }).map((_, i) => (
            <Tile key={i} letter="?" state="absent" position={i} />
          ))}
        </div>
        <div className="space-y-1">
          <h1 className="font-display font-black tracking-tight text-2xl text-text-primary">
            {state.kind === 'missing' ? 'No one to see here' : 'Something went wrong'}
          </h1>
          <p className="font-sans text-sm text-text-secondary">
            {state.kind === 'missing' ? 'This player is private or doesn’t exist.' : state.message}
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="inline-flex items-center px-5 py-2.5 rounded-md border-2 border-border-default hover:border-border-strong text-text-primary font-sans text-sm font-bold uppercase tracking-wider transition-colors"
        >
          Browse the leaderboard
        </Link>
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
    ? new Date(profile.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
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

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { ...springs.slide, delay },
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.section {...fadeUp(0)} aria-label="Player" className="rounded-card-lg bg-bg-base border border-border-default p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Avatar */}
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={64}
              height={64}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-card object-cover shrink-0 border border-border-subtle"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-card flex items-center justify-center shrink-0 font-sans font-bold text-3xl text-white select-none"
              style={{ backgroundColor: 'var(--tile-correct)', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' }}
              aria-hidden="true"
            >
              {initial}
            </div>
          )}

          {/* Name + pills */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="font-display font-black tracking-tight text-3xl text-text-primary truncate">{profile.username}</h1>
              {profile.is_me && <span className="font-sans text-[10px] text-text-ghost">(you)</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-semibold leading-none border"
                style={{
                  color: tier.color,
                  backgroundColor: `color-mix(in srgb, ${tier.color} 12%, transparent)`,
                  borderColor: `color-mix(in srgb, ${tier.color} 25%, transparent)`,
                }}
              >
                {tier.name}
              </span>
              {profile.is_placement && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-pill text-xs font-medium leading-none border"
                  style={{
                    color: 'var(--gold)',
                    backgroundColor: 'color-mix(in srgb, var(--gold) 10%, transparent)',
                    borderColor: 'color-mix(in srgb, var(--gold) 25%, transparent)',
                  }}
                >
                  Placement {Math.min(profile.rated_games, 5)}/5
                </span>
              )}
              {memberSince && <span className="font-sans text-xs text-text-secondary">Member since {memberSince}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {profile.is_me && (
              <Link
                href="/settings"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border-2 border-border-default hover:border-border-strong text-text-primary font-sans text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Pencil size={13} />
                Edit profile
              </Link>
            )}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-tile-correct text-white font-sans text-xs font-bold uppercase tracking-wider hover:brightness-110 transition"
            >
              <Share2 size={13} />
              Share
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ── Stat tiles ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" aria-label="Player statistics">
        <StatTile label="ELO" value={String(Math.round(profile.elo_rating))} sub={`${profile.rated_games} rated game${profile.rated_games === 1 ? '' : 's'}`} accent={tier.color} />
        <StatTile label="Peak" value={String(Math.round(profile.peak_elo))} delay={0.04} />
        <StatTile label="Win rate" value={`${Math.round(profile.win_rate)}%`} sub={`${profile.wins} of ${profile.completed}`} delay={0.08} />
        <StatTile label="Avg guesses" value={profile.avg_guesses != null ? profile.avg_guesses.toFixed(2) : '—'} sub="per win" delay={0.12} />
        <StatTile
          label="Avg accuracy"
          value={profile.avg_accuracy != null ? `${Math.round(profile.avg_accuracy)}%` : '—'}
          sub={profile.best_accuracy != null ? `best ${Math.round(profile.best_accuracy)}%` : undefined}
          delay={0.16}
        />
        <StatTile
          label="Streak"
          value={`${profile.current_streak}`}
          sub={`max ${profile.max_streak}`}
          accent={profile.current_streak > 0 ? 'var(--red)' : undefined}
          delay={0.2}
        />
      </div>

      {/* ── Distribution + rating line ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div {...fadeUp(0.15)}>
          <Card title="Guess distribution" icon={<BarChart2 size={14} />} aside={profile.completed > 0 ? `${profile.completed} games` : undefined}>
            {profile.completed > 0 ? (
              <GuessDistribution distribution={profile.guess_distribution} losses={losses} />
            ) : (
              <p className="font-sans text-sm text-text-secondary py-6 text-center">No completed games yet.</p>
            )}
          </Card>
        </motion.div>
        <motion.div {...fadeUp(0.2)} className="flex flex-col gap-5">
          <Card title="Rating history" icon={<TrendingUp size={14} />} aside={profile.elo_history.length > 1 ? `last ${profile.elo_history.length}` : undefined}>
            <EloLine history={profile.elo_history} />
          </Card>
          <Card title="Favourite opener" icon={<Flame size={14} />}>
            {profile.favourite_opener ? (
              <div className="flex items-center gap-4">
                <MiniWord word={profile.favourite_opener} size={28} />
                <span className="font-sans text-xs text-text-secondary">
                  played <span className="font-mono tabular-nums text-text-primary font-semibold">{profile.favourite_opener_plays}</span> time
                  {profile.favourite_opener_plays === 1 ? '' : 's'}
                </span>
                <Link
                  href={`/lab?word=${encodeURIComponent(profile.favourite_opener)}`}
                  className="ml-auto font-sans text-xs font-semibold shrink-0"
                  style={{ color: 'var(--tile-correct)' }}
                >
                  Analyse it
                </Link>
              </div>
            ) : (
              <p className="font-sans text-sm text-text-secondary">No opener yet.</p>
            )}
          </Card>
        </motion.div>
      </div>

      {/* ── Recent games ────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.25)}>
        <Card title="Recent games" icon={<History size={14} />} aside={profile.recent_games.length ? '* hard mode' : undefined}>
          {profile.recent_games.length === 0 ? (
            <p className="font-sans text-sm text-text-secondary py-4 text-center">Nothing played yet.</p>
          ) : (
            <div className="-mx-5 px-5 overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
              <div className="flex gap-2 pb-1 w-max">
                {profile.recent_games.map((g, i) => (
                  <GameColumn key={g.id} game={g} index={i} />
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>

      {/* ── Achievements ────────────────────────────────────────────────── */}
      <motion.div {...fadeUp(0.3)}>
        <Card title="Achievements" icon={<Award size={14} />} aside={achievements.length ? `${achievements.length} unlocked` : undefined}>
          {achievements.length === 0 ? (
            <p className="font-sans text-sm text-text-secondary py-4 text-center">No achievements yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {achievements.map((a) => {
                const meta = ACHIEVEMENT_META[a.type];
                const unlocked = a.unlocked_at
                  ? new Date(a.unlocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : null;
                return (
                  <span
                    key={a.type}
                    className="inline-flex items-center gap-1.5 rounded-pill text-xs px-3 py-1 font-sans font-semibold border border-border-subtle bg-bg-base text-text-primary"
                    title={[meta?.description, unlocked ? `Unlocked ${unlocked}` : null].filter(Boolean).join(' · ')}
                  >
                    <span className="text-sm leading-none" aria-hidden="true">
                      {meta?.icon ?? '🏆'}
                    </span>
                    {meta?.name ?? a.type.replace(/_/g, ' ')}
                  </span>
                );
              })}
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
