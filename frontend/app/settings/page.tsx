'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Palette,
  Zap,
  Trash2,
  UserX,
  AlertTriangle,
  Settings,
  Shield,
  Moon,
  Keyboard,
  Bell,
  BellOff,
  KeyRound,
  Smartphone,
  Monitor,
  LogOut,
  Globe,
  AtSign,
  Download,
  ExternalLink,
  Check,
} from 'lucide-react';
import { usersApi, authApi, errorMessage } from '@/lib/api';
import { THEME_OPTIONS, useSettings } from '@/lib/useSettings';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '@/lib/push';
import { pushApi, type PushPreferences, type SessionInfo } from '@/lib/api';
import ScrollArea from '@/components/ScrollArea';
import Dialog from '@/components/Dialog';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRefreshToken } from '@/lib/session';

/* ------------------------------------------------------------------ */
/*  Shared bits                                                         */
/* ------------------------------------------------------------------ */

const INPUT_CLS =
  'w-full px-3.5 py-2.5 text-sm rounded-md bg-transparent border-2 border-border-default text-text-primary placeholder:text-text-ghost focus:border-tile-correct focus:outline-none transition-colors disabled:opacity-40';

const DANGER_INPUT_CLS =
  'w-full px-3.5 py-2.5 text-sm rounded-md bg-transparent border-2 border-border-default text-text-primary placeholder:text-text-ghost focus:outline-none transition-colors disabled:opacity-40';

const PRIMARY_BTN =
  'px-4 py-2 text-sm rounded-md font-semibold bg-tile-correct text-white hover:brightness-110 transition-[filter] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2';

const SECONDARY_BTN =
  'px-4 py-2 text-sm rounded-md font-medium border-2 border-border-default hover:border-border-strong text-text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

const GHOST_BTN =
  'px-4 py-2 text-sm rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors disabled:opacity-40';

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs px-3 py-2 rounded-md border"
      role="alert"
      style={{
        color: 'var(--red)',
        backgroundColor: 'color-mix(in srgb, var(--red) 8%, transparent)',
        borderColor: 'color-mix(in srgb, var(--red) 20%, transparent)',
      }}
    >
      {children}
    </p>
  );
}

function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xs px-3 py-2 rounded-md border inline-flex items-center gap-1.5"
      role="status"
      style={{
        color: 'var(--green)',
        backgroundColor: 'color-mix(in srgb, var(--tile-correct) 10%, transparent)',
        borderColor: 'color-mix(in srgb, var(--tile-correct) 25%, transparent)',
      }}
    >
      <Check size={12} />
      {children}
    </p>
  );
}

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70" />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-2 px-1">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle switch                                                       */
/* ------------------------------------------------------------------ */

function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--green)]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-elevated)] shrink-0 disabled:opacity-50 ${
        checked
          ? 'bg-[var(--green)]'
          : 'bg-[var(--bg-muted)] border border-[var(--border-default)]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete All Games modal                                              */
/* ------------------------------------------------------------------ */

function DeleteGamesModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const hasPassword = user?.has_password !== false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmUsername, setConfirmUsername] = useState('');

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setConfirmed(false);
      setPassword('');
      setConfirmUsername('');
    }
  }, [open]);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await usersApi.deleteAllGames(
        hasPassword ? { password } : { confirm_username: confirmUsername },
      );
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const stepUpReady = hasPassword ? password.length > 0 : confirmUsername.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete All Game Data"
      accent="var(--red)"
      locked={loading}
      maxWidth="max-w-md"
    >
      <div className="p-5 pt-3 flex flex-col gap-4">
        <p className="text-sm text-text-secondary leading-relaxed">
          This will permanently delete{' '}
          <span className="text-text-primary font-medium">all your past games</span>. Your ELO
          rating will be preserved.
        </p>

        <ul className="text-sm text-text-secondary space-y-1.5 pl-4 list-disc">
          <li>All game history erased</li>
          <li>Win/loss record cleared</li>
          <li>Streaks reset</li>
        </ul>

        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="w-4 h-4 rounded cursor-pointer"
            style={{ accentColor: 'var(--red)' }}
          />
          <span className="text-sm text-text-secondary">
            I understand this action is{' '}
            <span className="text-text-primary font-medium">irreversible</span>
          </span>
        </label>

        <label className="block">
          <span className="block text-xs text-text-secondary mb-1.5">
            {hasPassword
              ? 'Re-enter your password to confirm'
              : `Type your username "${user?.username ?? ''}" to confirm`}
          </span>
          {hasPassword ? (
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={DANGER_INPUT_CLS}
              style={{ borderColor: password ? 'var(--red)' : undefined }}
            />
          ) : (
            <input
              type="text"
              autoComplete="off"
              value={confirmUsername}
              onChange={(e) => setConfirmUsername(e.target.value)}
              placeholder={user?.username ?? 'username'}
              className={DANGER_INPUT_CLS}
            />
          )}
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={loading} className={GHOST_BTN}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!confirmed || !stepUpReady || loading}
            className="px-4 py-2 text-sm rounded-md font-medium text-white hover:brightness-110 transition-[filter] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: 'var(--red)' }}
          >
            {loading ? (
              <>
                <Spinner />
                Deleting...
              </>
            ) : (
              'Delete All Games'
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Delete Account modal                                               */
/* ------------------------------------------------------------------ */

function DeleteAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const hasPassword = user?.has_password !== false;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) {
      setLoading(false);
      setError(null);
      setConfirmText('');
      setPassword('');
    }
  }, [open]);

  const canDelete =
    confirmText === 'DELETE' && (hasPassword ? password.length > 0 : true);

  const handleDelete = async () => {
    if (!canDelete) return;
    setLoading(true);
    setError(null);
    try {
      await usersApi.deleteAccount(
        hasPassword
          ? { password }
          : { confirm_username: user?.username ?? '' },
      );
      await logout();
      router.push('/login');
    } catch (err: unknown) {
      setError(errorMessage(err, 'Something went wrong. Please try again.'));
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Delete Account"
      accent="var(--red)"
      locked={loading}
      maxWidth="max-w-md"
    >
      <div className="p-5 pt-3 flex flex-col gap-4">
        <div
          className="flex items-start gap-2.5 px-3 py-2.5 rounded-md border"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--red) 8%, transparent)',
            borderColor: 'color-mix(in srgb, var(--red) 20%, transparent)',
          }}
        >
          <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--red)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--red)' }}>
            Your account, all game data, ELO history, and achievements will be permanently
            deleted and <strong>cannot be recovered</strong>.
          </p>
        </div>

        <p className="text-sm text-text-secondary">
          Type{' '}
          <span className="font-mono font-semibold text-text-primary tracking-widest">
            DELETE
          </span>{' '}
          to confirm:
        </p>

        <input
          data-autofocus
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canDelete) handleDelete();
          }}
          placeholder="DELETE"
          disabled={loading}
          className={`${DANGER_INPUT_CLS} font-mono tracking-wider`}
        />

        {hasPassword && (
          <label className="block">
            <span className="block text-xs text-text-secondary mb-1.5">
              Re-enter your password to confirm
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canDelete) handleDelete();
              }}
              disabled={loading}
              placeholder="Password"
              className={DANGER_INPUT_CLS}
            />
          </label>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} disabled={loading} className={GHOST_BTN}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canDelete || loading}
            className="px-4 py-2 text-sm rounded-md font-medium text-white hover:brightness-110 transition-[filter] disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ backgroundColor: 'var(--red)' }}
          >
            {loading ? (
              <>
                <Spinner />
                Deleting...
              </>
            ) : (
              'Delete My Account'
            )}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Setting row                                                         */
/* ------------------------------------------------------------------ */

function SettingRow({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-card bg-bg-elevated border border-border-subtle">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-bg-muted flex items-center justify-center shrink-0 text-text-secondary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">{title}</p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Notifications section                                              */
/* ------------------------------------------------------------------ */

const TRIGGER_LABELS: { key: keyof PushPreferences; title: string; description: string }[] = [
  {
    key: 'challenge_results',
    title: 'Challenge results',
    description: 'When someone plays a challenge you created.',
  },
  {
    key: 'achievement_unlock',
    title: 'Achievements',
    description: 'When you unlock a new achievement.',
  },
  {
    key: 'daily_reminder',
    title: 'Daily puzzle reminder',
    description: "A nudge in the morning if you haven't played today.",
  },
  {
    key: 'streak_warning',
    title: 'Streak warning',
    description: 'Evening alert if your streak is about to break.',
  },
];

function NotificationsSection() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [prefs, setPrefs] = useState<PushPreferences | null>(null);
  const [prefsBusy, setPrefsBusy] = useState<keyof PushPreferences | null>(null);

  useEffect(() => {
    getPushState().then(setState).catch(() => setState({ status: 'unsupported', endpoint: null }));
  }, []);

  // Load per-trigger preferences once we know the user is subscribed —
  // no need to fetch them when push is disabled entirely.
  useEffect(() => {
    if (state?.status !== 'subscribed') {
      setPrefs(null);
      return;
    }
    pushApi
      .getPreferences()
      .then((res) => setPrefs(res.data))
      .catch((err) => console.error('[push] load prefs failed', err));
  }, [state?.status]);

  const togglePref = async (key: keyof PushPreferences) => {
    if (!prefs || prefsBusy) return;
    setPrefsBusy(key);
    const optimistic = { ...prefs, [key]: !prefs[key] };
    setPrefs(optimistic);
    try {
      const res = await pushApi.updatePreferences({ [key]: optimistic[key] });
      setPrefs(res.data);
    } catch (err) {
      console.error('[push] update pref failed', err);
      setPrefs(prefs); // revert
      setFeedback("Couldn't save preference. Try again.");
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setPrefsBusy(null);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handleToggle = async () => {
    if (!state || busy) return;
    setBusy(true);
    try {
      if (state.status === 'subscribed') {
        const next = await unsubscribeFromPush();
        setState(next);
      } else {
        const next = await subscribeToPush();
        setState(next);
        if (next.status === 'denied') {
          showFeedback('Permission denied — enable notifications in your browser settings.');
        } else if (next.status === 'unsubscribed') {
          showFeedback('Could not enable notifications — try again after the page finishes loading.');
        }
      }
    } catch (err) {
      console.error('[push] toggle failed', err);
      showFeedback('Something went wrong. Check the console.');
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;

  const isSubscribed = state.status === 'subscribed';

  let description = 'Get notified about challenges and daily puzzles.';
  let disabledReason: string | null = null;
  switch (state.status) {
    case 'unsupported':
      disabledReason = 'Your browser does not support push notifications.';
      break;
    case 'server-disabled':
      disabledReason = 'Push notifications are not configured on this server.';
      break;
    case 'denied':
      disabledReason = 'Permission is blocked — re-enable it in your browser site settings.';
      break;
    case 'unsubscribed':
      description = 'Not enabled on this device.';
      break;
    case 'subscribed':
      description = 'Enabled on this device.';
      break;
  }

  return (
    <section>
      <SectionLabel>Notifications</SectionLabel>
      <div className="flex flex-col gap-2">
        <SettingRow
          icon={isSubscribed ? <Bell size={17} /> : <BellOff size={17} />}
          title="Push Notifications"
          description={disabledReason || description}
        >
          <button
            type="button"
            onClick={handleToggle}
            disabled={busy || !!disabledReason}
            className="px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-colors duration-150 disabled:opacity-50"
            style={{
              backgroundColor: isSubscribed ? 'var(--bg-muted)' : 'var(--tile-correct)',
              color: isSubscribed ? 'var(--text-primary)' : '#ffffff',
              border: isSubscribed ? '1px solid var(--border-default)' : '0',
            }}
          >
            {busy ? '...' : isSubscribed ? 'Disable' : 'Enable'}
          </button>
        </SettingRow>

        {isSubscribed && prefs && (
          <div className="flex flex-col gap-2 px-4 py-3 rounded-card bg-bg-elevated border border-border-subtle">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
              Notify me about
            </p>
            {TRIGGER_LABELS.map(({ key, title, description }) => (
              <div key={key} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">{title}</p>
                  <p className="text-xs text-text-secondary mt-0.5 leading-snug">{description}</p>
                </div>
                <Toggle
                  checked={prefs[key]}
                  onChange={() => togglePref(key)}
                  label={`Toggle ${title}`}
                />
              </div>
            ))}
          </div>
        )}

        {feedback && (
          <p className="text-xs px-3 py-2 rounded-[8px] bg-bg-muted border border-border-subtle text-text-secondary">
            {feedback}
          </p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Security section — password + sessions                             */
/* ------------------------------------------------------------------ */

function describeUserAgent(ua: string | null): { label: string; mobile: boolean } {
  if (!ua) return { label: 'Unknown device', mobile: false };
  const mobile = /Mobile|iPhone|iPad|Android/i.test(ua);
  let os = '';
  if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X|Macintosh/i.test(ua)) os = 'macOS';
  else if (/CrOS/i.test(ua)) os = 'ChromeOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = '';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\//i.test(ua)) browser = 'Opera';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = 'Safari';

  const label = [browser, os].filter(Boolean).join(' on ') || ua.slice(0, 40);
  return { label, mobile };
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const diff = Date.now() - t;
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d !== 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}

function ChangePasswordForm() {
  const { user, adoptTokens } = useAuth();
  const hasPassword = user?.has_password !== false;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit =
    next.length >= 8 && next === confirm && (!hasPassword || current.length > 0) && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    setSuccess(false);
    try {
      const res = await authApi.changePassword(
        hasPassword ? { current_password: current, new_password: next } : { new_password: next },
      );
      await adoptTokens(res.data);
      setCurrent('');
      setNext('');
      setConfirm('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not change password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="p-4 rounded-card bg-bg-elevated border border-border-subtle flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-bg-muted flex items-center justify-center shrink-0 text-text-secondary">
          <KeyRound size={17} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">
            {hasPassword ? 'Change password' : 'Set a password'}
          </p>
          <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
            {hasPassword
              ? 'Every other device is signed out; this one stays signed in.'
              : 'Your account uses Google sign-in. Add a password to also sign in with email.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {hasPassword && (
          <label className="block sm:col-span-2">
            <span className="block text-xs text-text-secondary mb-1">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={INPUT_CLS}
              disabled={busy}
            />
          </label>
        )}
        <label className="block">
          <span className="block text-xs text-text-secondary mb-1">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={INPUT_CLS}
            placeholder="At least 8 characters"
            disabled={busy}
          />
        </label>
        <label className="block">
          <span className="block text-xs text-text-secondary mb-1">Confirm new password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT_CLS}
            style={mismatch ? { borderColor: 'var(--red)' } : undefined}
            aria-invalid={mismatch || undefined}
            disabled={busy}
          />
        </label>
      </div>

      {mismatch && <ErrorNote>Passwords don&apos;t match.</ErrorNote>}
      {error && <ErrorNote>{error}</ErrorNote>}
      {success && <SuccessNote>Password updated.</SuccessNote>}

      <div className="flex justify-end">
        <button type="submit" disabled={!canSubmit} className={PRIMARY_BTN}>
          {busy && <Spinner />}
          {hasPassword ? 'Update password' : 'Set password'}
        </button>
      </div>
    </form>
  );
}

function ActiveSessions() {
  const router = useRouter();
  const { logout } = useAuth();
  const [sessions, setSessions] = useState<SessionInfo[] | null>(null);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const load = useCallback(() => {
    authApi
      .sessions(getRefreshToken())
      .then((res) => setSessions(res.data))
      .catch((err) => {
        setSessions([]);
        setError(errorMessage(err, 'Could not load sessions.'));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (s: SessionInfo) => {
    setRevoking(s.id);
    setError('');
    try {
      await authApi.revokeSession(s.id);
      if (s.current) {
        await logout();
        router.push('/login');
        return;
      }
      setSessions((prev) => (prev ? prev.filter((x) => x.id !== s.id) : prev));
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not sign out that session.'));
    } finally {
      setRevoking(null);
    }
  };

  const signOutEverywhere = async () => {
    setSigningOutAll(true);
    setError('');
    try {
      await authApi.logoutAll();
    } catch (err: unknown) {
      setError(errorMessage(err, 'Could not sign out everywhere.'));
      setSigningOutAll(false);
      return;
    }
    await logout();
    router.push('/login');
  };

  return (
    <div className="rounded-card bg-bg-elevated border border-border-subtle overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-bg-muted flex items-center justify-center shrink-0 text-text-secondary">
            <Monitor size={17} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">Active sessions</p>
            <p className="text-xs text-text-secondary mt-0.5">Devices currently signed in to your account.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOutEverywhere}
          disabled={signingOutAll}
          className="shrink-0 px-3 py-1.5 text-xs rounded-md font-medium border-2 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
          style={{ borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', color: 'var(--red)' }}
        >
          {signingOutAll ? <Spinner /> : <LogOut size={12} />}
          <span className="hidden sm:inline">Sign out everywhere</span>
          <span className="sm:hidden">All</span>
        </button>
      </div>

      {error && (
        <div className="px-4 pt-3">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}

      {sessions === null ? (
        <div className="px-4 py-6 text-center text-xs text-text-secondary">Loading sessions…</div>
      ) : sessions.length === 0 ? (
        <div className="px-4 py-6 text-center text-xs text-text-secondary">No active sessions found.</div>
      ) : (
        <ul className="divide-y divide-border-subtle" role="list">
          {sessions.map((s) => {
            const ua = describeUserAgent(s.user_agent);
            const Icon = ua.mobile ? Smartphone : Monitor;
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Icon size={16} className="text-text-secondary shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-text-primary truncate">{ua.label}</span>
                    {s.current && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-pill font-semibold"
                        style={{
                          color: 'var(--tile-correct)',
                          background: 'color-mix(in srgb, var(--tile-correct) 15%, transparent)',
                        }}
                      >
                        This device
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-secondary mt-0.5 font-mono tabular-nums truncate">
                    {s.ip_address ?? 'IP unknown'} · last active {relativeTime(s.last_used_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revoke(s)}
                  disabled={revoking === s.id || signingOutAll}
                  className="shrink-0 px-2.5 py-1 text-[11px] rounded-md border-2 border-border-default text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors disabled:opacity-40"
                >
                  {revoking === s.id ? <Spinner /> : 'Sign out'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SecuritySection() {
  return (
    <section>
      <SectionLabel>Security</SectionLabel>
      <div className="flex flex-col gap-2">
        <ChangePasswordForm />
        <ActiveSessions />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Privacy section — public profile, username, data export           */
/* ------------------------------------------------------------------ */

function PrivacySection() {
  const { user, setUser } = useAuth();
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  if (!user) return null;
  const isPublic = user.profile_public !== false;

  const togglePublic = async () => {
    if (profileBusy) return;
    setProfileBusy(true);
    setProfileError('');
    const nextValue = !isPublic;
    try {
      await usersApi.updateProfile({ profile_public: nextValue });
      setUser({ ...user, profile_public: nextValue });
    } catch (err: unknown) {
      setProfileError(errorMessage(err, 'Could not update profile visibility.'));
    } finally {
      setProfileBusy(false);
    }
  };

  const startEditName = () => {
    setNewName(user.username);
    setNameError('');
    setEditingName(true);
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || trimmed === user.username || nameBusy) return;
    setNameBusy(true);
    setNameError('');
    try {
      const res = await usersApi.updateProfile({ username: trimmed });
      const updated = res.data as { username?: string };
      setUser({ ...user, username: updated.username ?? trimmed });
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 4000);
    } catch (err: unknown) {
      setNameError(errorMessage(err, 'Could not change username.'));
    } finally {
      setNameBusy(false);
    }
  };

  const downloadData = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError('');
    try {
      const res = await usersApi.exportData();
      const blob = res.data instanceof Blob ? res.data : new Blob([JSON.stringify(res.data)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eloquence-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
      setExportError(errorMessage(err, 'Could not export your data.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section>
      <SectionLabel>Privacy</SectionLabel>
      <div className="flex flex-col gap-2">
        <SettingRow
          icon={<Globe size={17} />}
          title="Public profile"
          description={
            isPublic ? (
              <>
                Anyone can view your stats at{' '}
                <Link
                  href={`/u/${encodeURIComponent(user.username)}`}
                  className="inline-flex items-center gap-0.5 font-medium text-text-primary hover:underline"
                >
                  /u/{user.username}
                  <ExternalLink size={10} />
                </Link>
              </>
            ) : (
              'Your profile page and leaderboard links are hidden.'
            )
          }
        >
          <Toggle checked={isPublic} onChange={togglePublic} label="Toggle public profile" disabled={profileBusy} />
        </SettingRow>
        {profileError && <ErrorNote>{profileError}</ErrorNote>}

        <div className="p-4 rounded-card bg-bg-elevated border border-border-subtle flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-bg-muted flex items-center justify-center shrink-0 text-text-secondary">
                <AtSign size={17} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">Username</p>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                  Currently <span className="font-semibold text-text-primary">{user.username}</span>. You can change it up to 3 times a day.
                </p>
              </div>
            </div>
            {!editingName && (
              <button type="button" onClick={startEditName} className="shrink-0 px-3 py-1.5 text-xs rounded-md font-medium border-2 border-border-default hover:border-border-strong text-text-primary transition-colors">
                Change
              </button>
            )}
          </div>

          {editingName && (
            <form onSubmit={saveName} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={INPUT_CLS}
                maxLength={30}
                autoComplete="username"
                autoFocus
                disabled={nameBusy}
                aria-label="New username"
              />
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={() => setEditingName(false)} disabled={nameBusy} className={SECONDARY_BTN}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nameBusy || !newName.trim() || newName.trim() === user.username}
                  className={PRIMARY_BTN}
                >
                  {nameBusy && <Spinner />}
                  Save
                </button>
              </div>
            </form>
          )}
          {nameError && <ErrorNote>{nameError}</ErrorNote>}
          {nameSuccess && <SuccessNote>Username updated.</SuccessNote>}
        </div>

        <SettingRow
          icon={<Download size={17} />}
          title="Download my data"
          description="Export your account, games and history as JSON."
        >
          <button type="button" onClick={downloadData} disabled={exporting} className={`${SECONDARY_BTN} shrink-0 text-xs px-3 py-1.5 inline-flex items-center gap-1.5`}>
            {exporting ? <Spinner /> : <Download size={12} />}
            Export
          </button>
        </SettingRow>
        {exportError && <ErrorNote>{exportError}</ErrorNote>}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Main settings page                                                  */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [settings, setSetting] = useSettings();

  const [showDeleteGamesModal, setShowDeleteGamesModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [gamesDeletedBanner, setGamesDeletedBanner] = useState(false);
  const bannerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGamesDeleted = () => {
    setGamesDeletedBanner(true);
    if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
    bannerTimeout.current = setTimeout(() => setGamesDeletedBanner(false), 5000);
  };

  useEffect(() => {
    return () => {
      if (bannerTimeout.current) clearTimeout(bannerTimeout.current);
    };
  }, []);

  return (
    <>
      <div
        style={{
          background: 'var(--bg-base)',
          height: 'calc(100dvh - 52px)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <ScrollArea
          style={{
            width: '100%',
            maxWidth: '36rem',
            height: '100%',
            scrollbarGutter: 'stable',
            padding: '32px 16px 48px',
          }}
        >
        {/* Page header */}
        <div className="flex items-center gap-2.5 mb-7">
          <div className="p-2 rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary">
            <Settings size={18} />
          </div>
          <div>
            <h1 className="font-display font-black text-xl tracking-tight text-text-primary">Settings</h1>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {/* Game section */}
          <section>
            <SectionLabel>Game</SectionLabel>
            <div className="flex flex-col gap-2">
              <SettingRow
                icon={<Shield size={17} />}
                title="Hard Mode"
                description="Any revealed hints must be used in subsequent guesses. Applies to games you start from now on."
              >
                <Toggle
                  checked={settings.hardMode}
                  onChange={() => setSetting('hardMode', !settings.hardMode)}
                  label="Toggle hard mode"
                />
              </SettingRow>

              <SettingRow
                icon={<Keyboard size={17} />}
                title="Onscreen Keyboard Only"
                description="Ignore physical keyboard input. Helpful for users with assistive devices."
              >
                <Toggle
                  checked={settings.keyboardOnly}
                  onChange={() => setSetting('keyboardOnly', !settings.keyboardOnly)}
                  label="Toggle onscreen keyboard only"
                />
              </SettingRow>
            </div>
          </section>

          {/* Appearance section */}
          <section>
            <SectionLabel>Appearance</SectionLabel>
            <div className="flex flex-col gap-2">
              <SettingRow
                icon={<Moon size={17} />}
                title="Theme"
                description="System follows your device; Dark is the OLED palette."
              >
                <div
                  role="radiogroup"
                  aria-label="Theme"
                  className="flex shrink-0 rounded-pill bg-bg-muted p-0.5 border border-border-subtle"
                >
                  {THEME_OPTIONS.map((opt) => {
                    const active = settings.theme === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSetting('theme', opt)}
                        className={`px-3 py-1 rounded-pill text-xs font-semibold capitalize transition-colors ${
                          active ? 'bg-bg-base text-text-primary shadow-card' : 'text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </SettingRow>
            </div>
          </section>

          {/* Notifications section */}
          <NotificationsSection />

          {/* Accessibility section */}
          <section>
            <SectionLabel>Accessibility</SectionLabel>
            <div className="flex flex-col gap-2">
              <SettingRow
                icon={<Palette size={17} />}
                title="High Contrast Mode"
                description="Contrast and colorblindness improvements"
              >
                <Toggle
                  checked={settings.highContrast}
                  onChange={() => setSetting('highContrast', !settings.highContrast)}
                  label="Toggle high contrast mode"
                />
              </SettingRow>

              <SettingRow
                icon={<Zap size={17} />}
                title="Reduced Motion"
                description="Minimize animations throughout the app"
              >
                <Toggle
                  checked={settings.reducedMotion}
                  onChange={() => setSetting('reducedMotion', !settings.reducedMotion)}
                  label="Toggle reduced motion"
                />
              </SettingRow>

              {settings.highContrast && (
                <div className="p-4 rounded-card bg-bg-elevated border border-border-subtle">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary mb-3">
                    Color Preview
                  </p>
                  <div className="flex gap-2">
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: 'var(--tile-correct)' }}
                      aria-label="Correct position color: orange"
                    >
                      A
                    </div>
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: 'var(--tile-present)' }}
                      aria-label="Wrong position color: blue"
                    >
                      B
                    </div>
                    <div
                      className="w-10 h-10 rounded-md flex items-center justify-center text-white text-xs font-bold"
                      style={{ backgroundColor: 'var(--tile-absent)' }}
                      aria-label="Not in word color: gray"
                    >
                      C
                    </div>
                  </div>
                  <p className="text-[10px] text-text-secondary mt-2.5">
                    Orange = correct position · Blue = wrong position · Gray = not in word
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Security section */}
          <SecuritySection />

          {/* Privacy section */}
          <PrivacySection />

          {/* Danger zone section */}
          <section>
            <SectionLabel>Danger Zone</SectionLabel>

            <div
              className="rounded-card bg-bg-elevated overflow-hidden border"
              style={{ borderColor: 'color-mix(in srgb, var(--red) 30%, transparent)' }}
            >
              {/* Header strip */}
              <div
                className="flex items-center gap-2.5 px-4 py-3 border-b"
                style={{
                  borderColor: 'color-mix(in srgb, var(--red) 20%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--red) 5%, transparent)',
                }}
              >
                <AlertTriangle size={14} style={{ color: 'var(--red)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--red)' }}>
                  Irreversible actions — proceed with caution
                </span>
              </div>

              <div className="flex flex-col divide-y divide-border-subtle">
                {/* Delete All Games */}
                <div className="flex items-center justify-between px-4 py-4 gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                    >
                      <Trash2 size={14} style={{ color: 'var(--red)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">Delete All Game Data</p>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                        Erase all past games. Your ELO rating will be preserved.
                      </p>
                      {gamesDeletedBanner && (
                        <p className="text-xs mt-1.5 font-medium" style={{ color: 'var(--green)' }}>
                          All game data deleted. ELO preserved.
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteGamesModal(true)}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-md font-medium border-2 transition-colors"
                    style={{ borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)', color: 'var(--red)' }}
                  >
                    Delete Games
                  </button>
                </div>

                {/* Delete Account */}
                <div className="flex items-center justify-between px-4 py-4 gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--red) 10%, transparent)' }}
                    >
                      <UserX size={14} style={{ color: 'var(--red)' }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">Delete Account</p>
                      <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                        Permanently delete your account and all associated data.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-md font-medium border-2 transition-colors"
                    style={{
                      borderColor: 'color-mix(in srgb, var(--red) 40%, transparent)',
                      backgroundColor: 'color-mix(in srgb, var(--red) 15%, transparent)',
                      color: 'var(--red)',
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
        </ScrollArea>
      </div>

      <DeleteGamesModal
        open={showDeleteGamesModal}
        onClose={() => setShowDeleteGamesModal(false)}
        onSuccess={handleGamesDeleted}
      />
      <DeleteAccountModal
        open={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
      />
    </>
  );
}
