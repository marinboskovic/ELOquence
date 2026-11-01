import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasSession,
  setTokens,
  TokenPair,
} from './session';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Public, un-authenticated paths — a 401 here is the answer, never a reason
// to log the user out or try a token refresh.
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

function isAuthPath(url: string): boolean {
  return AUTH_PATHS.some((p) => url.includes(p)) || url.includes('/daily/guest');
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && !isAuthPath(config.url || '')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Silent refresh (single-flight) ────────────────────────────────────────
let refreshing: Promise<boolean> | null = null;

/**
 * Exchange the refresh token for a new pair. Concurrent callers share one
 * in-flight request so a burst of 401s doesn't rotate the token N times
 * (which the server would treat as reuse and revoke everything).
 */
export function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const refresh = getRefreshToken();
  if (!refresh) {
    // Nothing to refresh with (e.g. a pre-2.0 token or a token from another
    // dev DB): drop the dead access token, or every 401 bounces to /login forever.
    clearTokens();
    return Promise.resolve(false);
  }
  refreshing = axios
    .post<TokenPair>(`${API_URL}/api/auth/refresh`, { refresh_token: refresh }, { timeout: 15_000 })
    .then((res) => {
      setTokens(res.data);
      return true;
    })
    .catch(() => {
      clearTokens();
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  // Already on /login: a full navigation would reload the page and re-fire the
  // same 401, i.e. an infinite reload loop.
  if (window.location.pathname.startsWith('/login')) return;
  const here = window.location.pathname + window.location.search;
  const next = here.startsWith('/login') || here === '/' ? '' : `?next=${encodeURIComponent(here)}`;
  window.location.href = `/login${next}`;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = (error.config || {}) as AxiosRequestConfig & { _retried?: boolean };
    const url = config.url || '';
    const status = error.response?.status;

    if (status === 401 && !isAuthPath(url) && typeof window !== 'undefined') {
      // Step-up checks (delete account / games) return 401 for a wrong
      // password — that is feedback, not an expired session.
      const code = error.response?.headers?.['x-error-code'];
      const isStepUp = url.includes('/users/me') && config.method?.toLowerCase() === 'delete';
      if (!isStepUp && !config._retried && hasSession()) {
        config._retried = true;
        const ok = await refreshSession();
        if (ok) return api.request(config);
        // /auth/me only asks "who am I?" (public pages call it too). A dead
        // session there just means logged out; protected pages redirect themselves.
        if (!url.includes('/auth/me')) redirectToLogin();
      } else if (!isStepUp && !hasSession()) {
        // No credentials at all: a protected page was opened logged-out.
        if (code !== 'not_authenticated' || !url.includes('/auth/me')) redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);

/** Best-effort human message from an API error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length && typeof detail[0]?.msg === 'string') {
    return detail[0].msg.replace(/^Value error, /, '');
  }
  if (detail && typeof detail === 'object' && typeof (detail as { message?: string }).message === 'string') {
    return (detail as { message: string }).message;
  }
  return fallback;
}

/**
 * Client's local calendar date (YYYY-MM-DD). The daily puzzle is keyed to the
 * player's local date (Wordle-style), so the backend resolves "today" from
 * this rather than its own UTC clock.
 */
export function localDate(): string {
  const n = new Date();
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    api.post<TokenPair>('/auth/register', data),
  login: (data: { email: string; password: string }) => api.post<TokenPair>('/auth/login', data),
  google: (credential: string) => api.post<TokenPair>('/auth/google', { credential }),
  me: () => api.get('/auth/me'),
  logout: (refresh_token: string | null) => api.post('/auth/logout', { refresh_token }),
  logoutAll: () => api.post('/auth/logout-all'),
  sessions: (current: string | null) =>
    api.get<SessionInfo[]>('/auth/sessions', { params: current ? { current } : undefined }),
  revokeSession: (id: string) => api.delete(`/auth/sessions/${id}`),
  changePassword: (data: { current_password?: string; new_password: string }) =>
    api.post<TokenPair>('/auth/change-password', data),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<TokenPair>('/auth/reset-password', { token, password }),
};

export interface SessionInfo {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  current: boolean;
}

// ── Games ─────────────────────────────────────────────────────────────────
// Collection roots keep a trailing slash (`/games/`, `/daily/`,
// `/leaderboard/`): without it FastAPI 307-redirects and iOS/WebKit drops
// the Authorization header across the redirect.
export const gamesApi = {
  create: (data: { mode: string; word_pool?: string; hard_mode?: boolean }) => api.post('/games/', data),
  submitGuess: (gameId: string, guess: string) =>
    api.post(`/games/${gameId}/guess`, { guess, local_date: localDate() }),
  get: (gameId: string) => api.get(`/games/${gameId}`),
  list: (params?: { page?: number; per_page?: number; mode?: string }) => api.get('/games/', { params }),
  delete: (gameId: string) => api.delete(`/games/${gameId}`),
  /**
   * Fire-and-forget abandon used from `pagehide`. `fetch` with
   * `keepalive: true` survives the unload AND accepts a Bearer token
   * (sendBeacon can't). Errors are swallowed; the server-side stale-game
   * cleanup on the next create is the safety net.
   */
  abandonBeacon: (gameId: string) => {
    if (typeof window === 'undefined') return;
    const token = getAccessToken();
    if (!token) return;
    try {
      void fetch(`${API_URL}/api/games/${gameId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        keepalive: true,
      });
    } catch {
      /* page is unloading */
    }
  },
};

// ── Analysis ──────────────────────────────────────────────────────────────
export const analysisApi = {
  analyze: (gameId: string) => api.post(`/analysis/games/${gameId}/analyze`),
  labOpener: (word: string) => api.get<OpenerReport>(`/analysis/lab/opener/${encodeURIComponent(word)}`),
  labPosition: (guesses: string[], patterns: number[]) =>
    api.post<PositionReport>('/analysis/lab/position', { guesses, patterns }),
};

export interface OpenerPick {
  word: string;
  entropy: number;
  expected_remaining: number;
  rank: number;
  is_possible_answer: boolean;
}

export interface OpenerReport {
  word: string;
  entropy: number;
  best_entropy: number;
  efficiency: number;
  expected_remaining: number;
  worst_case_remaining: number;
  rank: number;
  total_guesses: number;
  percentile: number;
  answers_total: number;
  distinct_patterns: number;
  pattern_buckets: { pattern: number; count: number; probability: number; examples: string[] }[];
  best_openers: OpenerPick[];
  neighbours: { word: string; entropy: number; rank: number }[];
  facts: {
    unique_letters: number;
    vowels: number;
    repeated_letters: number;
    difficulty_elo: number;
    is_possible_answer: boolean;
  };
}

export interface PositionReport {
  history: { guess: string; pattern: number; remaining_before: number; remaining_after: number }[];
  remaining: number;
  remaining_words: string[];
  remaining_truncated: boolean;
  entropy_left: number;
  top_picks: {
    word: string;
    entropy: number;
    expected_remaining: number;
    is_possible_answer: boolean;
    worst_case_remaining: number;
  }[];
  solved: boolean;
}

// ── Daily ─────────────────────────────────────────────────────────────────
export const dailyApi = {
  get: () => api.get('/daily/', { params: { local_date: localDate() } }),
  play: () => api.post('/daily/play', null, { params: { local_date: localDate() } }),
  guest: () => api.post('/daily/guest', null, { params: { local_date: localDate() } }),
  guestGame: (gameId: string) => api.get(`/daily/guest/${gameId}`),
  guestGuess: (gameId: string, guess: string) => api.post(`/daily/guest/${gameId}/guess`, { guess }),
  archive: (year: number, month: number) => api.get('/daily/archive', { params: { year, month } }),
  replay: (date: string) => api.post('/daily/replay', { date }),
};

// ── Leaderboard ───────────────────────────────────────────────────────────
export interface Pulse {
  generated_at: string;
  today_daily: { date: string; players: number; solved: number; avg_guesses: number | null; fastest_seconds: number | null } | null;
  games_24h: number;
  players_total: number;
  hardest_this_week: { word: string; difficulty: number; plays: number; solve_rate: number } | null;
  easiest_this_week: { word: string; difficulty: number; plays: number; solve_rate: number } | null;
  season: { name: string; days_left: number; leader: { username: string; gain: number; rating: number } | null };
}
export const pulseApi = {
  get: () => api.get<Pulse>('/pulse/'),
};

export const leaderboardApi = {
  get: (params?: { page?: number; per_page?: number }) => api.get('/leaderboard/', { params }),
  nearMe: () => api.get('/leaderboard/near-me'),
  openers: (limit?: number) => api.get('/leaderboard/openers', { params: limit ? { limit } : undefined }),
  season: (params?: { year?: number; month?: number; limit?: number }) =>
    api.get<SeasonBoard>('/leaderboard/season', { params }),
};

export interface SeasonEntry {
  rank: number | null;
  user_id: string;
  username: string;
  elo_rating: number;
  elo_gain: number;
  games: number;
  wins: number;
  peak_elo: number | null;
  avg_accuracy: number | null;
}

export interface SeasonBoard {
  season: {
    name: string;
    year: number;
    month: number;
    starts_at: string;
    ends_at: string;
    is_current: boolean;
    days_left: number;
  };
  total_players: number;
  entries: SeasonEntry[];
  me: SeasonEntry | null;
}

// ── Users ─────────────────────────────────────────────────────────────────
export const usersApi = {
  eloHistory: (days?: number) => api.get('/users/me/elo-history', { params: days ? { days } : undefined }),
  stats: () => api.get('/users/me/stats'),
  updateProfile: (data: { username?: string; profile_public?: boolean }) => api.patch('/users/me', data),
  exportData: () => api.get('/users/me/export', { responseType: 'blob' }),
  deleteAllGames: (confirm: { password?: string; confirm_username?: string }) =>
    api.delete('/users/me/games', { data: confirm }),
  deleteAccount: (confirm: { password?: string; confirm_username?: string }) =>
    api.delete('/users/me', { data: confirm }),
};

// ── Public profiles ───────────────────────────────────────────────────────
export const profilesApi = {
  get: (username: string) => api.get<PublicProfile>(`/profiles/${encodeURIComponent(username)}`),
};

export interface PublicProfile {
  username: string;
  avatar_url: string | null;
  is_me: boolean;
  member_since: string | null;
  elo_rating: number;
  peak_elo: number;
  is_placement: boolean;
  rated_games: number;
  current_streak: number;
  max_streak: number;
  completed: number;
  wins: number;
  win_rate: number;
  avg_guesses: number | null;
  avg_accuracy: number | null;
  best_accuracy: number | null;
  favourite_opener: string | null;
  favourite_opener_plays: number;
  guess_distribution: Record<string, number>;
  achievements: { type: string; unlocked_at: string | null }[];
  elo_history: { elo: number; at: string | null }[];
  recent_games: {
    id: string;
    mode: string;
    status: string;
    num_guesses: number;
    hard_mode: boolean;
    accuracy_score: number | null;
    elo_delta: number | null;
    completed_at: string | null;
    patterns: number[];
  }[];
}

// ── AI ────────────────────────────────────────────────────────────────────
export const aiApi = {
  explainMove: (gameId: string, moveNumber: number) =>
    api.post('/ai/explain-move', { game_id: gameId, move_number: moveNumber }),
  gameSummary: (gameId: string) => api.post(`/ai/game-summary/${gameId}`),
  coachChat: (gameId: string, message: string, history: Array<{ role: string; content: string }>) =>
    api.post(`/ai/coach-chat/${gameId}`, { message, history }),
};

// ── Learn progress ────────────────────────────────────────────────────────
export const learnApi = {
  getProgress: () => api.get<{ progress: Record<string, number> }>('/learn/progress'),
  saveProgress: (progress: Record<string, number>) =>
    api.patch<{ progress: Record<string, number> }>('/learn/progress', { progress }),
};

// ── Achievements ──────────────────────────────────────────────────────────
export const achievementsApi = {
  mine: () => api.get('/achievements/me'),
  all: () => api.get('/achievements/all'),
};

// ── Admin ─────────────────────────────────────────────────────────────────
export const adminApi = {
  users: (params?: { page?: number; per_page?: number; search?: string; role?: string; order_by?: string; order?: string }) =>
    api.get('/admin/users', { params }),
  user: (userId: string) => api.get(`/admin/users/${userId}`),
  resetElo: (userId: string) => api.post(`/admin/users/${userId}/reset-elo`),
  toggleAdmin: (userId: string) => api.post(`/admin/users/${userId}/toggle-admin`),
  banUser: (userId: string, reason?: string) => api.post(`/admin/users/${userId}/ban`, { reason }),
  unbanUser: (userId: string) => api.post(`/admin/users/${userId}/unban`),
  dailyWords: () => api.get('/admin/daily-words'),
  setDailyWord: (data: { word: string; date: string; difficulty?: number }) => api.post('/admin/daily-words', data),
  analytics: () => api.get('/admin/analytics'),
  timeseries: (days?: number) => api.get('/admin/analytics/timeseries', { params: { days } }),
  distributions: () => api.get('/admin/analytics/distributions'),
  announcements: () => api.get('/admin/announcements'),
  createAnnouncement: (text: string) => api.post('/admin/announcements', { text }),
  updateAnnouncement: (id: string, data: { text?: string; active?: boolean }) =>
    api.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id: string) => api.delete(`/admin/announcements/${id}`),
  userGames: (userId: string, params?: { page?: number; per_page?: number; mode?: string; status?: string }) =>
    api.get(`/admin/users/${userId}/games`, { params }),
  games: (params?: { page?: number; per_page?: number; user_id?: string; mode?: string; status?: string; from?: string; to?: string }) =>
    api.get('/admin/games', { params }),
  game: (gameId: string) => api.get(`/admin/games/${gameId}`),
  auditLog: (params?: { page?: number; per_page?: number; action?: string; admin_id?: string }) =>
    api.get('/admin/audit-log', { params }),
  health: () => api.get('/admin/health'),
};

// ── Announcements (public) ────────────────────────────────────────────────
export const announcementsApi = {
  active: () => api.get('/announcements/active'),
};

// ── Challenges ────────────────────────────────────────────────────────────
export const challengesApi = {
  create: () => api.post('/challenges/create'),
  get: (code: string) => api.get(`/challenges/${code}`),
  play: (code: string) => api.post(`/challenges/${code}/play`),
  results: (code: string) => api.get(`/challenges/${code}/results`),
  mine: () => api.get('/challenges/mine'),
};

// ── Community stats ───────────────────────────────────────────────────────
export const communityApi = {
  gameStats: (gameId: string) => api.get(`/games/${gameId}/community-stats`),
};

// ── Push notifications ────────────────────────────────────────────────────
export interface PushPreferences {
  challenge_results: boolean;
  achievement_unlock: boolean;
  daily_reminder: boolean;
  streak_warning: boolean;
}

export const pushApi = {
  vapidPublicKey: () => api.get<{ public_key: string; enabled: boolean }>('/push/vapid-public-key'),
  subscribe: (subscription: PushSubscriptionJSON, userAgent?: string) =>
    api.post<{ id: string }>('/push/subscribe', { subscription, user_agent: userAgent }),
  unsubscribe: (endpoint: string) => api.delete<{ deleted: number }>('/push/subscribe', { data: { endpoint } }),
  test: () => api.post<{ sent: number; removed: number }>('/push/test'),
  getPreferences: () => api.get<PushPreferences>('/push/preferences'),
  updatePreferences: (patch: Partial<PushPreferences>) => api.patch<PushPreferences>('/push/preferences', patch),
};

export default api;
