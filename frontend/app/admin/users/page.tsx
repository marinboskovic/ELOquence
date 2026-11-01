'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi, errorMessage } from '@/lib/api';
import { getRatingTier } from '@/lib/types';
import Dialog from '@/components/Dialog';
import { Button, Label, Tag } from '@/components/ui';
import { AdminLoading, AdminPage, EmptyBand, ErrorBand, Field, INPUT, PanelLoading, Pager, TD, TH, TR } from '../_shared';

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

  if (loading) return <AdminLoading />;

  if (!user?.is_admin) return null;

  return (
    <AdminPage
      eyebrow={`admin · users · ${total.toLocaleString()} total`}
      title="Users"
      aside={
        <label className="relative block w-full md:w-72">
          <span className="sr-only">Search by username or email</span>
          <Search size={14} className="absolute left-0 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search username or email"
            className={`${INPUT} pl-6`}
          />
        </label>
      }
    >
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      {fetching ? (
        <PanelLoading label="Loading users" rows={8} />
      ) : users.length === 0 ? (
        <EmptyBand>No users match.</EmptyBand>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rule-top">
                <th className={TH}><Label>username</Label></th>
                <th className={`${TH} hidden sm:table-cell`}><Label>email</Label></th>
                <th className={`${TH} text-right`}><Label>elo</Label></th>
                <th className={`${TH} text-right hidden sm:table-cell`}><Label>games</Label></th>
                <th className={TH}><Label>role</Label></th>
                <th className={`${TH} text-right`}><Label>actions</Label></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const tier = getRatingTier(u.elo_rating);
                return (
                  <tr key={u.id} className={TR}>
                    <td className={TD}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/admin/users/${u.id}`} className="ink-link font-display font-bold text-text-primary">
                          {u.username}
                        </Link>
                        {u.is_banned && (
                          <Tag tone="accent" className="cursor-help" >
                            <span title={u.banned_reason ? `Banned: ${u.banned_reason}` : 'Banned'}>banned</span>
                          </Tag>
                        )}
                      </div>
                    </td>
                    <td className={`${TD} hidden sm:table-cell text-text-secondary truncate max-w-[220px]`}>{u.email}</td>
                    <td className={`${TD} text-right`}>
                      <span className="font-mono font-semibold tabular text-text-primary">{Math.round(u.elo_rating)}</span>
                      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">{tier.name}</span>
                    </td>
                    <td className={`${TD} text-right font-mono tabular text-text-secondary hidden sm:table-cell`}>{u.games_played}</td>
                    <td className={TD}>
                      {u.is_admin ? <Tag tone="ink">admin</Tag> : <Tag>user</Tag>}
                    </td>
                    <td className={`${TD} text-right`}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant={confirmReset === u.id ? 'danger' : 'ghost'}
                          size="sm"
                          onClick={() => handleResetElo(u.id)}
                          loading={actionLoading === u.id + '-reset'}
                        >
                          {confirmReset === u.id ? 'Confirm?' : 'Reset ELO'}
                        </Button>
                        <Button
                          type="button"
                          variant={confirmAdmin === u.id ? 'danger' : 'ghost'}
                          size="sm"
                          onClick={() => handleToggleAdmin(u.id)}
                          loading={actionLoading === u.id + '-admin'}
                        >
                          {confirmAdmin === u.id ? 'Confirm?' : u.is_admin ? 'Demote' : 'Make admin'}
                        </Button>
                        <Button
                          type="button"
                          variant={u.is_banned ? 'secondary' : 'danger'}
                          size="sm"
                          onClick={() => (u.is_banned ? handleUnban(u.id) : setBanTarget(u))}
                          disabled={u.id === user.id}
                          loading={actionLoading === u.id + '-ban'}
                          title={u.id === user.id ? 'You cannot ban yourself' : undefined}
                        >
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <BanDialog
        open={!!banTarget}
        username={banTarget?.username ?? ''}
        onClose={() => setBanTarget(null)}
        onConfirm={handleBan}
      />

      <Pager
        page={page}
        totalPages={totalPages}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      />
    </AdminPage>
  );
}
