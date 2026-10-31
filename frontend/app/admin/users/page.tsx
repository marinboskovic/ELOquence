'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Search, ShieldCheck, RefreshCw, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi, errorMessage } from '@/lib/api';
import { getRatingTier } from '@/lib/types';
import AdminNav from '@/components/admin/AdminNav';
import Dialog from '@/components/Dialog';

/* ------------------------------------------------------------------ */
/*  Ban dialog + pill (local to this page — components/admin is not   */
/*  owned by this change)                                              */
/* ------------------------------------------------------------------ */

function BannedPill({ reason }: { reason?: string | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-pill text-[10px] font-semibold font-sans"
      style={{
        background: 'color-mix(in srgb, var(--red) 12%, transparent)',
        color: 'var(--red)',
      }}
      title={reason ? `Banned: ${reason}` : 'Banned'}
    >
      <Ban size={10} />
      Banned
    </span>
  );
}

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
      <form onSubmit={submit} className="p-5 pt-3 flex flex-col gap-4">
        <p className="font-sans text-sm text-text-secondary leading-relaxed">
          The user will be signed out everywhere and blocked from signing in. You can lift the ban later.
        </p>
        <label className="block">
          <span className="block text-xs text-text-secondary mb-1.5">Reason (optional, shown to admins)</span>
          <input
            data-autofocus
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={200}
            placeholder="e.g. abusive username"
            disabled={busy}
            className="w-full px-3.5 py-2.5 text-sm rounded-md bg-transparent border-2 border-border-default text-text-primary placeholder:text-text-ghost focus:border-tile-correct focus:outline-none transition-colors disabled:opacity-40 font-sans"
          />
        </label>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors disabled:opacity-40 font-sans"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm rounded-md font-medium text-white hover:brightness-110 transition-[filter] disabled:opacity-40 inline-flex items-center gap-2 font-sans"
            style={{ backgroundColor: 'var(--red)' }}
          >
            {busy ? <RefreshCw size={12} className="animate-spin" /> : <Ban size={12} />}
            Ban user
          </button>
        </div>
      </form>
    </Dialog>
  );
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  elo_rating: number;
  games_played: number;
  is_admin: boolean;
  is_banned?: boolean;
  banned_reason?: string | null;
  created_at: string;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
}

export default function AdminUsersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [confirmAdmin, setConfirmAdmin] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const PER_PAGE = 20;

  const fetchUsers = useCallback(
    (p: number, q: string) => {
      setFetching(true);
      adminApi
        .users({ page: p, per_page: PER_PAGE, search: q || undefined })
        .then((res) => {
          const data: UsersResponse = res.data;
          setUsers(data.users);
          setTotal(data.total);
        })
        .catch(() => setError('Failed to load users.'))
        .finally(() => setFetching(false));
    },
    []
  );

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchUsers(page, search);
    // `search` is deliberately excluded: typing is debounced in
    // handleSearchChange, which issues its own fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, page, fetchUsers]);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers(1, val);
    }, 350);
  };

  const handleResetElo = async (userId: string) => {
    if (confirmReset !== userId) {
      setConfirmReset(userId);
      return;
    }
    setActionLoading(userId + '-reset');
    setConfirmReset(null);
    try {
      await adminApi.resetElo(userId);
      fetchUsers(page, search);
    } catch {
      setError('Failed to reset ELO.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleAdmin = async (userId: string) => {
    // Two-click confirmation — promoting/demoting an admin is a privileged,
    // irreversible (until re-toggled) action; a misclick in a busy table
    // should not be possible.
    if (confirmAdmin !== userId) {
      setConfirmAdmin(userId);
      return;
    }
    setActionLoading(userId + '-admin');
    setConfirmAdmin(null);
    try {
      await adminApi.toggleAdmin(userId);
      fetchUsers(page, search);
    } catch {
      setError('Failed to toggle admin.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async (reason: string) => {
    if (!banTarget) return;
    const id = banTarget.id;
    setActionLoading(id + '-ban');
    try {
      await adminApi.banUser(id, reason || undefined);
      setBanTarget(null);
      fetchUsers(page, search);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to ban user.'));
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnban = async (userId: string) => {
    setActionLoading(userId + '-ban');
    try {
      await adminApi.unbanUser(userId);
      fetchUsers(page, search);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Failed to unban user.'));
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100dvh-52px)]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!user?.is_admin) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin" className="font-sans text-text-secondary hover:text-text-primary text-sm transition-colors">
              Admin
            </Link>
            <span className="text-text-tertiary text-sm">/</span>
            <span className="font-sans text-sm text-text-primary">Users</span>
          </div>
          <h1 className="font-display font-black text-3xl text-text-primary">Admin · Users</h1>
          <p className="font-sans text-text-secondary mt-0.5">{total.toLocaleString()} total users</p>
        </div>
      </motion.div>

      <AdminNav />

      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 px-4 py-3 rounded-card border text-sm flex items-center justify-between" style={{ background: 'rgba(231,76,60,0.08)', borderColor: 'rgba(231,76,60,0.25)', color: 'var(--red)' }}>
          <span>{error}</span>
          <button className="ml-2 underline text-xs" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by username or email..."
          className="w-full pl-9 pr-4 bg-transparent border-2 border-border-default rounded-md px-3 py-2 focus:border-tile-correct outline-none text-text-primary font-sans text-sm placeholder:text-text-tertiary transition-colors"
        />
      </div>

      {/* Table card */}
      <div className="bg-bg-base border border-border-default rounded-card-lg overflow-hidden">
        {fetching ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--tile-correct)', borderTopColor: 'transparent' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-text-secondary font-sans text-sm">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b-2 border-border-default">
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Username</th>
                  <th className="text-left px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold hidden sm:table-cell">Email</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">ELO</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold hidden sm:table-cell">Games</th>
                  <th className="text-center px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Role</th>
                  <th className="text-right px-4 py-2 text-xs uppercase tracking-wider text-text-secondary font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const tier = getRatingTier(u.elo_rating);
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-border-subtle hover:bg-bg-elevated/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-text-primary">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link href={`/admin/users/${u.id}`} className="hover:underline hover:text-tile-correct transition-colors">
                            {u.username}
                          </Link>
                          {u.is_banned && <BannedPill reason={u.banned_reason} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary hidden sm:table-cell truncate max-w-[200px]">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums" style={{ color: tier.color }}>
                        {Math.round(u.elo_rating)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary tabular-nums hidden sm:table-cell">
                        {u.games_played}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: 'rgba(201,162,39,0.12)', color: 'var(--gold)' }}>
                            <ShieldCheck size={10} />
                            Admin
                          </span>
                        ) : (
                          <span className="text-[10px] text-text-tertiary">User</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleResetElo(u.id)}
                            disabled={actionLoading === u.id + '-reset'}
                            className={`text-[11px] px-2 py-1 rounded-md border-2 transition-colors font-sans ${
                              confirmReset === u.id
                                ? 'bg-transparent text-text-primary'
                                : 'bg-transparent border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong'
                            }`}
                            style={confirmReset === u.id ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}
                          >
                            {actionLoading === u.id + '-reset' ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : confirmReset === u.id ? (
                              'Confirm?'
                            ) : (
                              'Reset ELO'
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleAdmin(u.id)}
                            disabled={actionLoading === u.id + '-admin'}
                            className={`text-[11px] px-2 py-1 rounded-md border-2 transition-colors font-sans ${
                              confirmAdmin === u.id
                                ? 'bg-transparent text-text-primary'
                                : 'bg-transparent border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong'
                            }`}
                            style={confirmAdmin === u.id ? { borderColor: 'var(--red)', color: 'var(--red)' } : undefined}
                          >
                            {actionLoading === u.id + '-admin' ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : confirmAdmin === u.id ? (
                              'Confirm?'
                            ) : u.is_admin ? (
                              'Demote'
                            ) : (
                              'Make Admin'
                            )}
                          </button>
                          <button
                            onClick={() => (u.is_banned ? handleUnban(u.id) : setBanTarget(u))}
                            disabled={actionLoading === u.id + '-ban' || u.id === user.id}
                            title={u.id === user.id ? 'You cannot ban yourself' : undefined}
                            className="text-[11px] px-2 py-1 rounded-md border-2 transition-colors font-sans bg-transparent disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            style={
                              u.is_banned
                                ? { borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }
                                : { borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', color: 'var(--red)' }
                            }
                          >
                            {actionLoading === u.id + '-ban' ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : u.is_banned ? (
                              'Unban'
                            ) : (
                              <>
                                <Ban size={10} />
                                Ban
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <BanDialog
        open={!!banTarget}
        username={banTarget?.username ?? ''}
        onClose={() => setBanTarget(null)}
        onConfirm={handleBan}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary font-sans">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-md border-2 border-border-default hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
