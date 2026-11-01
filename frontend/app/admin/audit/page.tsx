'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Label, Reveal } from '@/components/ui';
import { AdminLoading, AdminPage, EmptyBand, ErrorBand, Field, PanelLoading, Pager, SELECT, TD, TH } from '../_shared';

interface AuditEntry {
  id: string;
  admin_user_id: string;
  admin_username: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  payload: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  per_page: number;
}

interface AdminUser {
  id: string;
  username: string;
  is_admin: boolean;
}

const ACTION_OPTIONS = [
  '',
  'reset_elo',
  'toggle_admin',
  'set_daily_word',
  'delete_daily_word',
  'create_announcement',
  'update_announcement',
  'delete_announcement',
  'trigger_notification',
];

const ACTION_LABELS: Record<string, string> = {
  reset_elo: 'Reset ELO',
  toggle_admin: 'Toggle admin',
  set_daily_word: 'Set daily word',
  delete_daily_word: 'Delete daily word',
  create_announcement: 'Post announcement',
  update_announcement: 'Update announcement',
  delete_announcement: 'Delete announcement',
  trigger_notification: 'Trigger notification',
};

function actionVerb(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m !== 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d !== 1 ? 's' : ''} ago`;
}

const PER_PAGE = 50;

export default function AdminAuditPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [adminFilter, setAdminFilter] = useState('');
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  const [expandedPayloads, setExpandedPayloads] = useState<Set<string>>(new Set());

  // Tick every minute so relativeTime() updates ("2 minutes ago" → "3 minutes ago")
  // without the user needing to refresh the page.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchEntries = useCallback((p: number, action: string, adminId: string) => {
    setFetching(true);
    adminApi.auditLog({
      page: p,
      per_page: PER_PAGE,
      action: action || undefined,
      admin_id: adminId || undefined,
    })
      .then((res: { data: AuditResponse }) => {
        setEntries(res.data.entries ?? []);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => setError('Failed to load audit log.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchEntries(1, '', '');
    // Fetch admin list for filter
    adminApi.users({ role: 'admin', per_page: 200 } as Parameters<typeof adminApi.users>[0])
      .then((res: { data: { users: AdminUser[] } }) => setAdmins(res.data.users ?? []))
      .catch(() => {});
  }, [user, loading, router, fetchEntries]);

  const togglePayload = (id: string) => {
    setExpandedPayloads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (loading) return <AdminLoading />;

  if (!user?.is_admin) return null;

  return (
    <AdminPage
      eyebrow={`admin · audit log · ${total.toLocaleString()} entries`}
      title="Audit"
      aside={
        <div className="grid grid-cols-2 gap-4 w-full md:w-80">
          <Field label="action">
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
                fetchEntries(1, e.target.value, adminFilter);
              }}
              className={SELECT}
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>{a ? actionVerb(a) : 'All actions'}</option>
              ))}
            </select>
          </Field>
          <Field label="admin">
            <select
              value={adminFilter}
              onChange={(e) => {
                setAdminFilter(e.target.value);
                setPage(1);
                fetchEntries(1, actionFilter, e.target.value);
              }}
              className={SELECT}
            >
              <option value="">All admins</option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>{a.username}</option>
              ))}
            </select>
          </Field>
        </div>
      }
    >
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      <Reveal as="section">
        {fetching ? (
          <PanelLoading label="Loading audit log" rows={10} />
        ) : entries.length === 0 ? (
          <EmptyBand>No audit entries match.</EmptyBand>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="rule-top">
                <th className={`${TH} w-28 hidden sm:table-cell`}><Label>when</Label></th>
                <th className={TH}><Label>entry</Label></th>
                <th className={`${TH} text-right hidden md:table-cell`}><Label>ip</Label></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const hasPayload = entry.payload && Object.keys(entry.payload).length > 0;
                const expanded = expandedPayloads.has(entry.id);
                return (
                  <tr key={entry.id} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors align-top">
                    <td className={`${TD} hidden sm:table-cell`}>
                      <span className="font-mono text-xs text-text-tertiary tabular" title={new Date(entry.created_at).toLocaleString()}>
                        {relativeTime(entry.created_at)}
                      </span>
                    </td>
                    <td className={TD}>
                      <p className="text-text-primary">
                        <span className="font-display font-bold">{entry.admin_username}</span>
                        <span className="text-text-secondary"> {actionVerb(entry.action).toLowerCase()}</span>
                        {entry.target_label && (
                          <span className="text-text-secondary">
                            {' '}· <span className="font-mono text-xs text-text-primary">{entry.target_label}</span>
                          </span>
                        )}
                      </p>
                      <span className="sm:hidden font-mono text-[11px] text-text-tertiary tabular" title={new Date(entry.created_at).toLocaleString()}>
                        {relativeTime(entry.created_at)}
                      </span>
                      {hasPayload && (
                        <button
                          type="button"
                          onClick={() => togglePayload(entry.id)}
                          aria-expanded={expanded}
                          className="flex items-center gap-1 mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text-tertiary hover:text-text-primary transition-colors"
                        >
                          <ChevronDown
                            size={11}
                            className={clsx('transition-transform duration-fast', expanded && 'rotate-180')}
                            aria-hidden="true"
                          />
                          {expanded ? 'hide' : 'show'} payload
                        </button>
                      )}
                      <AnimatePresence>
                        {expanded && hasPayload && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <pre className="mt-2 p-3 bg-bg-muted font-mono text-[11px] leading-relaxed text-text-secondary overflow-x-auto">
                              {JSON.stringify(entry.payload, null, 2)}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </td>
                    <td className={`${TD} text-right hidden md:table-cell`}>
                      {entry.ip_address && <span className="font-mono text-xs text-text-tertiary tabular">{entry.ip_address}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <Pager
          page={page}
          totalPages={totalPages}
          onPrev={() => { const p = Math.max(1, page - 1); setPage(p); fetchEntries(p, actionFilter, adminFilter); }}
          onNext={() => { const p = Math.min(totalPages, page + 1); setPage(p); fetchEntries(p, actionFilter, adminFilter); }}
        />
      </Reveal>
    </AdminPage>
  );
}
