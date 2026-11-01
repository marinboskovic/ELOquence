'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi, errorMessage } from '@/lib/api';
import { getRatingTier, EloHistoryEntry } from '@/lib/types';
import EloSparkline from '@/components/EloSparkline';
import DonutChart from '@/components/admin/DonutChart';
import Dialog from '@/components/Dialog';
import { Button, Label, Reveal, Stat, Tag } from '@/components/ui';
import {
  AdminLoading,
  AdminPage,
  EloDelta,
  EmptyBand,
  ErrorBand,
  Field,
  INPUT,
  PanelHead,
  PanelLoading,
  Pager,
  StatusTag,
  TD,
  TH,
  TR,
} from '../../_shared';

/* ------------------------------------------------------------------ */
/*  Ban dialog (local to this page)                                    */
/* ------------------------------------------------------------------ */

function BanDialog({
  open,
  username,
  onClose,
  onConfirm,
}: {
  open: boolean;
  username: string;
  onClose: () => void;
  /** Rejects on failure so the dialog stays open. */
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setBusy(false);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } catch {
      /* error surfaced by the page */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title={`Ban ${username}?`} accent="var(--red)" locked={busy} maxWidth="max-w-sm">
      <form onSubmit={submit} className="p-5 pt-3 flex flex-col gap-5">
        <p className="text-sm text-text-secondary leading-relaxed">
          The user will be signed out everywhere and blocked from signing in. You can lift the ban later.
        </p>
        <Field label="reason · optional, shown to admins">
          <input
            data-autofocus
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="e.g. abusive username"
            disabled={busy}
            className={INPUT}
          />
        </Field>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" size="sm" loading={busy}>
            Ban user
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

interface AdminUser {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  games_played: number;
  total_wins: number;
  total_losses: number;
  is_placement: boolean;
  is_admin: boolean;
  provider: string | null;
  current_streak: number;
  max_streak: number;
  last_played_date: string | null;
  is_banned?: boolean;
  banned_reason?: string | null;
  created_at: string;
}

interface UserProfile {
  total_games: number;
  total_wins: number;
  avg_accuracy: number | null;
}

interface UserDetail {
  user: AdminUser;
  profile: UserProfile | null;
  elo_history: EloHistoryEntry[];
  recent_games_count: { won: number; lost: number; abandoned: number };
  games_by_mode: { daily: number; competitive: number; practice: number; challenge: number };
}

interface AdminGame {
  id: string;
  mode: string;
  status: string;
  target_word: string;
  num_guesses: number;
  elo_before: number | null;
  elo_after: number | null;
  elo_delta: number | null;
  accuracy_score: number | null;
  rated: boolean;
  is_placement: boolean;
  hard_mode: boolean;
  created_at: string;
  completed_at: string | null;
}

interface GamesResponse {
  games: AdminGame[];
  total: number;
  page: number;
  per_page: number;
}

export default function AdminUserDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [gamesPage, setGamesPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmAdmin, setConfirmAdmin] = useState(false);
  const [banOpen, setBanOpen] = useState(false);

  const PER_PAGE = 20;

  const fetchDetail = useCallback(() => {
    adminApi.user(userId)
      .then((res) => setDetail(res.data))
      .catch(() => setError('Failed to load user.'))
      .finally(() => setFetching(false));
  }, [userId]);

  const fetchGames = useCallback((page: number) => {
    setGamesLoading(true);
    adminApi.userGames(userId, { page, per_page: PER_PAGE })
      .then((res: { data: GamesResponse }) => {
        setGames(res.data.games);
        setGamesTotal(res.data.total);
      })
      .catch(() => {})
      .finally(() => setGamesLoading(false));
  }, [userId]);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchDetail();
    fetchGames(1);
  }, [user, loading, router, fetchDetail, fetchGames]);

  const handleResetElo = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setActionLoading('reset');
    setConfirmReset(false);
    try {
      await adminApi.resetElo(userId);
      fetchDetail();
    } catch {
      setError('Failed to reset ELO.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async () => {
    if (!confirmAdmin) {
      setConfirmAdmin(true);
      return;
    }
    setActionLoading('admin');
    setConfirmAdmin(false);
    try {
      await adminApi.toggleAdmin(userId);
      fetchDetail();
    } catch {
      setError('Failed to toggle admin.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async (reason: string) => {
    setActionLoading('ban');
    try {
      await adminApi.banUser(userId, reason || undefined);
      setBanOpen(false);
      fetchDetail();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to ban user.'));
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async () => {
    setActionLoading('ban');
    try {
      await adminApi.unbanUser(userId);
      fetchDetail();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to unban user.'));
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || fetching) return <AdminLoading />;

  if (!user?.is_admin) return null;
  if (!detail) {
    return (
      <AdminPage eyebrow="admin · users" title="User" crumbs={[['users', '/admin/users']]}>
        {error ? <ErrorBand>{error}</ErrorBand> : <EmptyBand>User not found.</EmptyBand>}
      </AdminPage>
    );
  }

  const { user: u, profile, elo_history, recent_games_count, games_by_mode } = detail;
  const tier = getRatingTier(u.elo_rating);

  // ELO delta vs the oldest entry in our history window. Backend returns
  // entries newest-first, so the oldest is at the tail.
  const eloNow = u.elo_rating;
  const elo30dAgo = elo_history.length > 0
    ? elo_history[elo_history.length - 1].elo_before
    : eloNow;
  const eloDelta30d = eloNow - elo30dAgo;

  // Win rate last 30 days
  const totalRecent = recent_games_count.won + recent_games_count.lost + recent_games_count.abandoned;
  const recentWinRate = totalRecent > 0 ? ((recent_games_count.won / totalRecent) * 100).toFixed(0) : '—';

  // Mode donut
  const modeSegs = [
    { key: 'daily', label: 'Daily', value: games_by_mode.daily, color: 'var(--text-primary)' },
    { key: 'competitive', label: 'Competitive', value: games_by_mode.competitive, color: 'var(--tile-correct)' },
    { key: 'practice', label: 'Practice', value: games_by_mode.practice, color: 'var(--tile-present)' },
    { key: 'challenge', label: 'Challenge', value: games_by_mode.challenge, color: 'var(--accent)' },
  ].filter((s) => s.value > 0);

  // Recent outcome donut
  const outcomeSegs = [
    { key: 'won', label: 'Won', value: recent_games_count.won, color: 'var(--tile-correct)' },
    { key: 'lost', label: 'Lost', value: recent_games_count.lost, color: 'var(--text-primary)' },
    { key: 'abandoned', label: 'Abandoned', value: recent_games_count.abandoned, color: 'var(--tile-absent)' },
  ].filter((s) => s.value > 0);

  const totalPages = Math.ceil(gamesTotal / PER_PAGE);
  const isSelf = user.id === u.id;

  return (
    <AdminPage
      eyebrow={`admin · user · joined ${new Date(u.created_at).toLocaleDateString()}`}
      title={u.username}
      crumbs={[['users', '/admin/users']]}
      aside={
        <div className="flex flex-col md:items-end gap-2">
          <div className="flex items-center gap-1.5 flex-wrap md:justify-end">
            {u.is_admin && <Tag tone="ink">admin</Tag>}
            {u.provider === 'google' && <Tag>google</Tag>}
            <Tag tone="ochre">{tier.name}</Tag>
            {u.is_banned && <Tag tone="accent">banned</Tag>}
          </div>
          <span className="font-mono text-xs text-text-secondary">{u.email}</span>
          {u.is_banned && u.banned_reason && (
            <span className="text-xs text-text-secondary">ban reason: {u.banned_reason}</span>
          )}
        </div>
      }
    >
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      <div className="flex flex-col gap-12 md:gap-16">
        {/* ── Stats 3-up, editorial: rating larger ── */}
        <Reveal as="section" className="grid grid-cols-2 md:grid-cols-12 gap-x-8 gap-y-6">
          <Stat
            className="col-span-2 md:col-span-5"
            label="elo rating"
            value={Math.round(u.elo_rating)}
            size="lg"
            sub={
              <span className="font-mono tabular">
                {eloDelta30d !== 0 ? `${eloDelta30d > 0 ? '+' : ''}${eloDelta30d} vs 30d ago` : 'no change in 30d'}
                {u.is_placement ? ' · placement' : ''}
              </span>
            }
          />
          <Stat
            className="md:col-span-3"
            label="games played"
            value={u.games_played}
            sub={<span className="font-mono tabular">{(profile?.total_wins ?? 0).toLocaleString()} wins lifetime</span>}
          />
          <Stat
            className="md:col-span-2"
            label="win rate · 30d"
            value={recentWinRate === '—' ? '—' : `${recentWinRate}%`}
            sub={<span className="font-mono tabular">{totalRecent} games</span>}
          />
          <Stat
            className="md:col-span-2"
            label="streak"
            value={u.current_streak}
            sub={<span className="font-mono tabular">best {u.max_streak}</span>}
          />
        </Reveal>

        {/* ── Rating history ── */}
        {elo_history.length > 0 && (
          <Reveal as="section" delay={0.05}>
            <PanelHead title="Rating history" aside={`${elo_history.length} rated games`} />
            <EloSparkline data={elo_history} height={180} />
          </Reveal>
        )}

        {/* ── Donuts 7/5 ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12">
          <Reveal as="section" delay={0.08} className="md:col-span-7">
            <PanelHead title="Games by mode" />
            <DonutChart segments={modeSegs} size={120} ariaLabel="Games by mode" />
          </Reveal>
          <Reveal as="section" delay={0.1} className="md:col-span-5">
            <PanelHead title="Recent outcomes" aside="last 30 days" />
            <DonutChart segments={outcomeSegs} size={120} ariaLabel="Recent outcomes" />
          </Reveal>
        </div>

        {/* ── Admin actions — the one wash band on the page ── */}
        <Reveal as="section" delay={0.12}>
          <PanelHead title="Admin actions" aside={isSelf ? 'you cannot change your own role' : undefined} />
          <div className="bg-wash-accent px-4 md:px-6 py-5 flex flex-wrap gap-3 items-center">
            <Button
              type="button"
              variant={confirmReset ? 'danger' : 'secondary'}
              size="sm"
              onClick={handleResetElo}
              loading={actionLoading === 'reset'}
            >
              {confirmReset ? 'Confirm reset ELO?' : 'Reset ELO'}
            </Button>
            <Button
              type="button"
              variant={confirmAdmin ? 'danger' : 'secondary'}
              size="sm"
              onClick={handleToggleAdmin}
              disabled={isSelf}
              loading={actionLoading === 'admin'}
              title={isSelf ? 'Cannot change your own admin role' : undefined}
            >
              {confirmAdmin ? (u.is_admin ? 'Confirm demote?' : 'Confirm make admin?') : u.is_admin ? 'Demote admin' : 'Make admin'}
            </Button>
            <Button
              type="button"
              variant={u.is_banned ? 'secondary' : 'danger'}
              size="sm"
              onClick={() => (u.is_banned ? handleUnban() : setBanOpen(true))}
              disabled={isSelf}
              loading={actionLoading === 'ban'}
              title={isSelf ? 'You cannot ban yourself' : undefined}
            >
              {u.is_banned ? 'Unban user' : 'Ban user'}
            </Button>
          </div>
        </Reveal>

        <BanDialog
          open={banOpen}
          username={u.username}
          onClose={() => setBanOpen(false)}
          onConfirm={handleBan}
        />

        {/* ── Recent games ── */}
        <Reveal as="section" delay={0.15}>
          <PanelHead title="Recent games" aside={`${gamesTotal.toLocaleString()} total`} />
          {gamesLoading ? (
            <PanelLoading label="Loading games" rows={6} />
          ) : games.length === 0 ? (
            <EmptyBand>No games yet.</EmptyBand>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="rule-top">
                    <th className={TH}><Label>mode</Label></th>
                    <th className={TH}><Label>word</Label></th>
                    <th className={TH}><Label>status</Label></th>
                    <th className={`${TH} text-right`}><Label>elo</Label></th>
                    <th className={`${TH} text-right hidden sm:table-cell`}><Label>date</Label></th>
                    <th className={`${TH} text-right`}><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {games.map((g) => (
                    <tr key={g.id} className={TR}>
                      <td className={TD}>
                        <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-secondary">{g.mode}</span>
                        {g.is_placement && <span className="ml-1.5 font-mono text-[10px] text-text-tertiary" title="Placement">P</span>}
                        {g.hard_mode && <span className="ml-1.5 font-mono text-[10px] text-text-tertiary" title="Hard mode">H</span>}
                      </td>
                      <td className={TD}>
                        <span className="font-display font-black uppercase tracking-[0.08em] text-text-primary">{g.target_word}</span>
                      </td>
                      <td className={TD}>
                        <StatusTag status={g.status} />
                      </td>
                      <td className={`${TD} text-right`}>
                        <EloDelta delta={g.elo_delta} />
                      </td>
                      <td className={`${TD} text-right font-mono text-xs tabular text-text-tertiary hidden sm:table-cell`}>
                        {new Date(g.created_at).toLocaleDateString()}
                      </td>
                      <td className={`${TD} text-right`}>
                        <Link href={`/admin/games/${g.id}`} className="inline-flex text-text-tertiary hover:text-text-primary transition-colors" aria-label="Open game">
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Pager
            page={gamesPage}
            totalPages={totalPages}
            onPrev={() => { const p = Math.max(1, gamesPage - 1); setGamesPage(p); fetchGames(p); }}
            onNext={() => { const p = Math.min(totalPages, gamesPage + 1); setGamesPage(p); fetchGames(p); }}
          />
        </Reveal>
      </div>
    </AdminPage>
  );
}
