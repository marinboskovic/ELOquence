'use client';
import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { adminApi } from '@/lib/api';
import { Button, Label, Reveal } from '@/components/ui';
import {
  AdminLoading,
  AdminPage,
  EloDelta,
  EmptyBand,
  ErrorBand,
  Field,
  INPUT,
  PanelLoading,
  Pager,
  SELECT,
  StatusTag,
  TD,
  TH,
  TR,
} from '../_shared';

interface AdminGame {
  id: string;
  user_id: string | null;
  username: string | null;
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

interface UserSearchResult {
  id: string;
  username: string;
}

const MODE_OPTIONS = ['', 'daily', 'competitive', 'practice', 'challenge'];
const STATUS_OPTIONS = ['', 'in_progress', 'won', 'lost', 'abandoned'];

const PER_PAGE = 50;

function AdminGamesPageInner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filters from URL
  const [userSearch, setUserSearch] = useState(searchParams.get('username') ?? '');
  const [userId, setUserId] = useState(searchParams.get('user_id') ?? '');
  const [mode, setMode] = useState(searchParams.get('mode') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const [games, setGames] = useState<AdminGame[]>([]);
  const [total, setTotal] = useState(0);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  const [userSuggestions, setUserSuggestions] = useState<UserSearchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const userDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushParams = useCallback((overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { user_id: userId, mode, status, from: dateFrom, to: dateTo, page, username: userSearch, ...overrides };
    if (merged.user_id) p.set('user_id', String(merged.user_id));
    if (merged.username) p.set('username', String(merged.username));
    if (merged.mode) p.set('mode', String(merged.mode));
    if (merged.status) p.set('status', String(merged.status));
    if (merged.from) p.set('from', String(merged.from));
    if (merged.to) p.set('to', String(merged.to));
    if (merged.page && Number(merged.page) > 1) p.set('page', String(merged.page));
    router.push(`/admin/games?${p.toString()}`);
  }, [userId, mode, status, dateFrom, dateTo, page, userSearch, router]);

  const fetchGames = useCallback((params: {
    page?: number; user_id?: string; mode?: string; status?: string; from?: string; to?: string;
  }) => {
    setFetching(true);
    adminApi.games({
      page: params.page ?? 1,
      per_page: PER_PAGE,
      user_id: params.user_id || undefined,
      mode: params.mode || undefined,
      status: params.status || undefined,
      from: params.from || undefined,
      to: params.to || undefined,
    })
      .then((res: { data: GamesResponse }) => {
        setGames(res.data.games);
        setTotal(res.data.total);
      })
      .catch(() => setError('Failed to load games.'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user || !user.is_admin) {
      router.replace('/play');
      return;
    }
    fetchGames({ page, user_id: userId, mode, status, from: dateFrom, to: dateTo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  const handleUserSearch = (val: string) => {
    setUserSearch(val);
    setUserId('');
    if (userDebounce.current) clearTimeout(userDebounce.current);
    if (!val.trim()) {
      setUserSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    userDebounce.current = setTimeout(() => {
      adminApi.users({ search: val, per_page: 5 } as Parameters<typeof adminApi.users>[0])
        .then((res: { data: { users: UserSearchResult[] } }) => {
          setUserSuggestions(res.data.users ?? []);
          setShowSuggestions(true);
        })
        .catch(() => {});
    }, 350);
  };

  const selectUser = (u: UserSearchResult) => {
    setUserSearch(u.username);
    setUserId(u.id);
    setShowSuggestions(false);
    const newPage = 1;
    setPage(newPage);
    fetchGames({ page: newPage, user_id: u.id, mode, status, from: dateFrom, to: dateTo });
    pushParams({ user_id: u.id, username: u.username, page: newPage });
  };

  const applyFilters = (overrides: Partial<{ mode: string; status: string; from: string; to: string; page: number }> = {}) => {
    const newMode = overrides.mode ?? mode;
    const newStatus = overrides.status ?? status;
    const newFrom = overrides.from ?? dateFrom;
    const newTo = overrides.to ?? dateTo;
    const newPage = overrides.page ?? 1;
    setPage(newPage);
    fetchGames({ page: newPage, user_id: userId, mode: newMode, status: newStatus, from: newFrom, to: newTo });
    pushParams({ mode: newMode, status: newStatus, from: newFrom, to: newTo, page: newPage, user_id: userId, username: userSearch });
  };

  const clearFilters = () => {
    setUserSearch('');
    setUserId('');
    setMode('');
    setStatus('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
    fetchGames({ page: 1 });
    router.push('/admin/games');
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  if (loading) return <AdminLoading />;

  if (!user?.is_admin) return null;

  const hasFilters = !!(userId || mode || status || dateFrom || dateTo);

  return (
    <AdminPage eyebrow={`admin · games · ${total.toLocaleString()} total`} title="Games">
      {error && <ErrorBand onDismiss={() => setError('')}>{error}</ErrorBand>}

      {/* ── Filter rail: one hair-ruled row of underline fields ── */}
      <Reveal as="section" className="rule-top pt-4 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-x-6 gap-y-4 items-end">
          {/* User search */}
          <div className="relative col-span-2 md:col-span-4">
            <Field label="user">
              <div className="relative">
                <Search size={13} className="absolute left-0 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search username"
                  className={`${INPUT} pl-5 pr-7`}
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => { setUserSearch(''); setUserId(''); setShowSuggestions(false); }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-text-tertiary hover:text-text-primary"
                    aria-label="Clear user"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </Field>
            {showSuggestions && userSuggestions.length > 0 && (
              <ul className="absolute z-10 left-0 right-0 mt-1 bg-bg-base border-2 border-border-default shadow-ink" role="listbox">
                {userSuggestions.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 font-display font-bold text-sm text-text-primary hover:bg-bg-ink hover:text-text-on-ink transition-colors"
                      onMouseDown={() => selectUser(u)}
                      role="option"
                      aria-selected={false}
                    >
                      {u.username}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Field label="mode" className="md:col-span-2">
            <select
              value={mode}
              onChange={(e) => { setMode(e.target.value); applyFilters({ mode: e.target.value }); }}
              className={SELECT}
            >
              {MODE_OPTIONS.map((m) => (
                <option key={m} value={m}>{m ? m.charAt(0).toUpperCase() + m.slice(1) : 'All modes'}</option>
              ))}
            </select>
          </Field>

          <Field label="status" className="md:col-span-2">
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); applyFilters({ status: e.target.value }); }}
              className={SELECT}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All statuses'}</option>
              ))}
            </select>
          </Field>

          <Field label="from" className="md:col-span-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); applyFilters({ from: e.target.value }); }}
              className={INPUT}
            />
          </Field>

          <Field label="to" className="md:col-span-2">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); applyFilters({ to: e.target.value }); }}
              className={INPUT}
            />
          </Field>
        </div>
        {hasFilters && (
          <div className="mt-4">
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
              <X size={12} aria-hidden="true" />
              Clear filters
            </Button>
          </div>
        )}
      </Reveal>

      {/* ── Table ── */}
      {fetching ? (
        <PanelLoading label="Loading games" rows={10} />
      ) : games.length === 0 ? (
        <EmptyBand>No games match.</EmptyBand>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="rule-top">
                <th className={TH}><Label>user</Label></th>
                <th className={TH}><Label>mode</Label></th>
                <th className={`${TH} hidden sm:table-cell`}><Label>word</Label></th>
                <th className={TH}><Label>status</Label></th>
                <th className={`${TH} text-right`}><Label>elo</Label></th>
                <th className={`${TH} text-right hidden sm:table-cell`}><Label>guesses</Label></th>
                <th className={`${TH} text-right hidden md:table-cell`}><Label>date</Label></th>
                <th className={`${TH} text-right`}><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id} className={TR}>
                  <td className={TD}>
                    {g.user_id ? (
                      <Link href={`/admin/users/${g.user_id}`} className="ink-link font-display font-bold text-text-primary">
                        {g.username ?? g.user_id.slice(0, 8)}
                      </Link>
                    ) : (
                      <span className="text-text-tertiary">Guest</span>
                    )}
                  </td>
                  <td className={TD}>
                    <span className="font-mono text-xs uppercase tracking-[0.12em] text-text-secondary">{g.mode}</span>
                    {g.is_placement && <span className="ml-1.5 font-mono text-[10px] text-text-tertiary" title="Placement">P</span>}
                    {g.hard_mode && <span className="ml-1.5 font-mono text-[10px] text-text-tertiary" title="Hard mode">H</span>}
                  </td>
                  <td className={`${TD} hidden sm:table-cell`}>
                    <span className="font-display font-black uppercase tracking-[0.08em] text-text-primary">{g.target_word}</span>
                  </td>
                  <td className={TD}>
                    <StatusTag status={g.status} />
                  </td>
                  <td className={`${TD} text-right`}>
                    <EloDelta delta={g.elo_delta} />
                  </td>
                  <td className={`${TD} text-right font-mono tabular text-text-secondary hidden sm:table-cell`}>
                    {g.num_guesses > 0 ? g.num_guesses : '—'}
                  </td>
                  <td className={`${TD} text-right font-mono text-xs tabular text-text-tertiary hidden md:table-cell`}>
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
        page={page}
        totalPages={totalPages}
        note={`${total.toLocaleString()} total`}
        onPrev={() => { const p = Math.max(1, page - 1); setPage(p); applyFilters({ page: p }); }}
        onNext={() => { const p = Math.min(totalPages, page + 1); setPage(p); applyFilters({ page: p }); }}
      />
    </AdminPage>
  );
}

// Wrapping the page in Suspense is required by Next.js 14 App Router whenever
// a client component reads useSearchParams() — without it the page is opted
// out of static prerendering and may flash blank in production.
export default function AdminGamesPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <AdminGamesPageInner />
    </Suspense>
  );
}
