'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import clsx from 'clsx';
import { AlertCircle, Check, Smartphone, Monitor, ExternalLink } from 'lucide-react';
import { usersApi, authApi, errorMessage } from '@/lib/api';
import { THEME_OPTIONS, useSettings } from '@/lib/useSettings';
import {
  getPushState,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '@/lib/push';
import { pushApi, type PushPreferences, type SessionInfo } from '@/lib/api';
import Dialog from '@/components/Dialog';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRefreshToken } from '@/lib/session';
import { Button, Label, Reveal, SectionHead, SplitWords, Tag } from '@/components/ui';

/* ------------------------------------------------------------------ */
/*  Shared bits                                                         */
/* ------------------------------------------------------------------ */

/** Underline input — the one text-field style across Atelier forms. */
const INPUT_CLS =
  'w-full border-0 border-b-2 border-border-default focus:border-accent bg-transparent px-0 py-2.5 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors duration-fast disabled:opacity-40';

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm text-accent" role="alert">
      <AlertCircle size={15} aria-hidden="true" className="shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  );
}

function SuccessNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-sm text-text-primary" role="status">
      <Check size={14} aria-hidden="true" style={{ color: 'var(--tile-correct)' }} />
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle — a 40×22 rectangle with a square knob, no radius           */
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
      className={clsx(
        'relative shrink-0 w-10 h-[22px] border-2 transition-colors duration-fast disabled:opacity-40 disabled:cursor-not-allowed',
        checked ? 'bg-accent border-accent' : 'bg-transparent border-border-default'
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'absolute top-[2px] left-[2px] w-[14px] h-[14px] transition-transform duration-fast ease-out',
          checked ? 'translate-x-[18px] bg-accent-ink' : 'translate-x-0 bg-border-default'
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Row — title · description · control, separated by hair rules       */
/* ------------------------------------------------------------------ */

function Row({
  title,
  description,
  children,
  align = 'center',
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className={clsx('rule-hair py-5 flex gap-6 justify-between', align === 'center' ? 'items-center' : 'items-start')}>
      <div className="min-w-0">
        <p className="text-base font-medium text-text-primary">{title}</p>
        {description && <p className="text-sm text-text-secondary mt-1 leading-relaxed">{description}</p>}
      </div>
      {children && <div className="shrink-0 flex items-center gap-2">{children}</div>}
    </div>
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
      title="Delete all game data"
      accent="var(--red)"
      locked={loading}
      maxWidth="max-w-md"
    >
      <div className="p-5 pt-3 flex flex-col gap-5">
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
            className="w-4 h-4 cursor-pointer"
            style={{ accentColor: 'var(--red)' }}
          />
          <span className="text-sm text-text-secondary">
            I understand this action is{' '}
            <span className="text-text-primary font-medium">irreversible</span>
          </span>
        </label>

        <label className="block">
          <Label className="block mb-1">
            {hasPassword ? 'password' : `type "${user?.username ?? ''}"`}
          </Label>
          {hasPassword ? (
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Re-enter your password to confirm"
              className={INPUT_CLS}
            />
          ) : (
            <input
              type="text"
              autoComplete="off"
              value={confirmUsername}
              onChange={(e) => setConfirmUsername(e.target.value)}
              placeholder={user?.username ?? 'username'}
              className={INPUT_CLS}
            />
          )}
        </label>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={!confirmed || !stepUpReady}
            loading={loading}
          >
            {loading ? 'Deleting…' : 'Delete all games'}
          </Button>
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
      title="Delete account"
      accent="var(--red)"
      locked={loading}
      maxWidth="max-w-md"
    >
      <div className="p-5 pt-3 flex flex-col gap-5">
        <div className="bg-wash-accent p-4 flex items-start gap-2.5">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-accent" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-text-primary">
            Your account, all game data, ELO history, and achievements will be permanently
            deleted and <strong>cannot be recovered</strong>.
          </p>
        </div>

        <label className="block">
          <Label className="block mb-1">type DELETE to confirm</Label>
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
            className={`${INPUT_CLS} font-mono tracking-[0.14em]`}
          />
        </label>

        {hasPassword && (
          <label className="block">
            <Label className="block mb-1">password</Label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canDelete) handleDelete();
              }}
              disabled={loading}
              placeholder="Re-enter your password to confirm"
              className={INPUT_CLS}
            />
          </label>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={!canDelete} loading={loading}>
            {loading ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      </div>
    </Dialog>
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
    <Reveal as="section" id="notifications" className="scroll-mt-20">
      <SectionHead eyebrow="03" title="Notifications" className="mb-4" />
      <Row title="Push notifications" description={disabledReason || description}>
        <Button
          type="button"
          variant={isSubscribed ? 'secondary' : 'primary'}
          size="sm"
          onClick={handleToggle}
          disabled={!!disabledReason}
          loading={busy}
        >
          {isSubscribed ? 'Disable' : 'Enable'}
        </Button>
      </Row>

      {isSubscribed && prefs && (
        <div className="pl-0 md:pl-6">
          {TRIGGER_LABELS.map(({ key, title, description }) => (
            <Row key={key} title={title} description={description}>
              <Toggle
                checked={prefs[key]}
                onChange={() => togglePref(key)}
                label={`Toggle ${title}`}
                disabled={prefsBusy === key}
              />
            </Row>
          ))}
        </div>
      )}

      {feedback && (
        <p className="rule-hair pt-3 text-sm text-text-secondary" role="status">
          {feedback}
        </p>
      )}
    </Reveal>
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
    <form onSubmit={submit} className="rule-hair py-5 grid grid-cols-1 md:grid-cols-12 gap-6">
      <div className="md:col-span-5">
        <p className="text-base font-medium text-text-primary">{hasPassword ? 'Change password' : 'Set a password'}</p>
        <p className="text-sm text-text-secondary mt-1 leading-relaxed">
          {hasPassword
            ? 'Every other device is signed out; this one stays signed in.'
            : 'Your account uses Google sign-in. Add a password to also sign in with email.'}
        </p>
      </div>

      <div className="md:col-span-7 flex flex-col gap-5">
        {hasPassword && (
          <label className="block">
            <Label className="block mb-1">current password</Label>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <label className="block">
            <Label className="block mb-1">new password</Label>
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
            <Label className="block mb-1">confirm new password</Label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={clsx(INPUT_CLS, mismatch && 'border-accent')}
              aria-invalid={mismatch || undefined}
              disabled={busy}
            />
          </label>
        </div>

        {mismatch && <ErrorNote>Passwords don&apos;t match.</ErrorNote>}
        {error && <ErrorNote>{error}</ErrorNote>}
        {success && <SuccessNote>Password updated.</SuccessNote>}

        <div className="flex justify-end">
          <Button type="submit" variant="secondary" size="sm" disabled={!canSubmit} loading={busy}>
            {hasPassword ? 'Update password' : 'Set password'}
          </Button>
        </div>
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
    <div className="rule-hair py-5">
      <div className="flex items-start justify-between gap-6 mb-4">
        <div className="min-w-0">
          <p className="text-base font-medium text-text-primary">Active sessions</p>
          <p className="text-sm text-text-secondary mt-1">Devices currently signed in to your account.</p>
        </div>
        <Button type="button" variant="danger" size="sm" onClick={signOutEverywhere} loading={signingOutAll} className="shrink-0">
          <span className="hidden sm:inline">Sign out everywhere</span>
          <span className="sm:hidden">All</span>
        </Button>
      </div>

      {error && <div className="mb-3"><ErrorNote>{error}</ErrorNote></div>}

      {sessions === null ? (
        <div className="flex flex-col">
          {[0, 1].map((i) => (
            <div key={i} className="border-b border-border-subtle py-3 flex items-center gap-3">
              <div className="skeleton bg-bg-muted h-4 w-40" />
              <div className="skeleton bg-bg-muted h-3 w-24 ml-auto" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="py-3 text-sm text-text-secondary">No active sessions found.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="rule-top">
              <th className="text-left py-2 font-normal"><Label>device</Label></th>
              <th className="text-left py-2 font-normal hidden sm:table-cell"><Label>ip · last active</Label></th>
              <th className="text-right py-2 font-normal"><Label>action</Label></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => {
              const ua = describeUserAgent(s.user_agent);
              const Icon = ua.mobile ? Smartphone : Monitor;
              return (
                <tr key={s.id} className="border-b border-border-subtle hover:bg-bg-elevated transition-colors">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon size={14} className="text-text-secondary shrink-0" aria-hidden="true" />
                      <span className="font-medium text-text-primary">{ua.label}</span>
                      {s.current && <Tag tone="green">This device</Tag>}
                    </div>
                    <p className="sm:hidden font-mono text-xs text-text-secondary tabular mt-1">
                      {s.ip_address ?? 'IP unknown'} · {relativeTime(s.last_used_at)}
                    </p>
                  </td>
                  <td className="py-3 pr-3 font-mono text-xs text-text-secondary tabular hidden sm:table-cell">
                    {s.ip_address ?? 'IP unknown'} · {relativeTime(s.last_used_at)}
                  </td>
                  <td className="py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(s)}
                      disabled={signingOutAll}
                      loading={revoking === s.id}
                    >
                      Sign out
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SecuritySection() {
  return (
    <Reveal as="section" id="security" className="scroll-mt-20">
      <SectionHead eyebrow="05" title="Security" className="mb-4" />
      <ChangePasswordForm />
      <ActiveSessions />
    </Reveal>
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
    <Reveal as="section" id="privacy" className="scroll-mt-20">
      <SectionHead eyebrow="06" title="Privacy" className="mb-4" />
      <Row
        title="Public profile"
        description={
          isPublic ? (
            <>
              Anyone can view your stats at{' '}
              <Link
                href={`/u/${encodeURIComponent(user.username)}`}
                className="ink-link inline-flex items-center gap-0.5 font-medium text-text-primary"
              >
                /u/{user.username}
                <ExternalLink size={10} aria-hidden="true" />
              </Link>
            </>
          ) : (
            'Your profile page and leaderboard links are hidden.'
          )
        }
      >
        <Toggle checked={isPublic} onChange={togglePublic} label="Toggle public profile" disabled={profileBusy} />
      </Row>
      {profileError && <div className="pb-3"><ErrorNote>{profileError}</ErrorNote></div>}

      <div className="rule-hair py-5">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-base font-medium text-text-primary">Username</p>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed">
              Currently <span className="font-display font-bold text-text-primary">{user.username}</span>. You can change it up to 3 times a day.
            </p>
          </div>
          {!editingName && (
            <Button type="button" variant="secondary" size="sm" onClick={startEditName} className="shrink-0">
              Change
            </Button>
          )}
        </div>

        {editingName && (
          <form onSubmit={saveName} className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block flex-1">
              <Label className="block mb-1">new username</Label>
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
            </label>
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingName(false)} disabled={nameBusy}>
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!newName.trim() || newName.trim() === user.username}
                loading={nameBusy}
              >
                Save
              </Button>
            </div>
          </form>
        )}
        {nameError && <div className="mt-3"><ErrorNote>{nameError}</ErrorNote></div>}
        {nameSuccess && <div className="mt-3"><SuccessNote>Username updated.</SuccessNote></div>}
      </div>

      <Row title="Download my data" description="Export your account, games and history as JSON.">
        <Button type="button" variant="secondary" size="sm" onClick={downloadData} loading={exporting}>
          Export
        </Button>
      </Row>
      {exportError && <div className="pb-3"><ErrorNote>{exportError}</ErrorNote></div>}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/*  Sticky index                                                        */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: 'game', label: 'Game' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'danger', label: 'Danger' },
];

function SettingsIndex() {
  const [active, setActive] = useState<string>(SECTIONS[0].id);

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -65% 0px', threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <nav aria-label="Settings sections" className="md:sticky md:top-20">
      <Label className="block mb-3">index</Label>
      <ol className="flex md:flex-col gap-x-5 gap-y-2 flex-wrap">
        {SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? 'location' : undefined}
              className={clsx(
                'ink-link inline-flex items-baseline gap-2 text-sm transition-colors duration-fast',
                active === s.id ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
              )}
              style={active === s.id ? { backgroundSize: '100% 2px' } : undefined}
            >
              <span className="font-mono text-[10px] text-text-tertiary tabular">{String(i + 1).padStart(2, '0')}</span>
              {s.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
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
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Page header */}
        <header className="mb-10 md:mb-14">
          <Label className="block mb-2">settings · account</Label>
          <SplitWords text="Settings" as="h1" className="font-display text-display-lg text-text-primary" />
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
          {/* Index — narrow column, sticky on desktop */}
          <aside className="md:col-span-3 lg:col-span-3 order-first">
            <SettingsIndex />
          </aside>

          {/* Content */}
          <div className="md:col-span-9 lg:col-span-8 lg:col-start-5 flex flex-col gap-12 md:gap-16">
            {/* Game */}
            <Reveal as="section" id="game" className="scroll-mt-20">
              <SectionHead eyebrow="01" title="Game" className="mb-4" />
              <Row
                title="Hard mode"
                description="Any revealed hints must be used in subsequent guesses. Applies to games you start from now on."
              >
                <Toggle
                  checked={settings.hardMode}
                  onChange={() => setSetting('hardMode', !settings.hardMode)}
                  label="Toggle hard mode"
                />
              </Row>
              <Row
                title="Onscreen keyboard only"
                description="Ignore physical keyboard input. Helpful for users with assistive devices."
              >
                <Toggle
                  checked={settings.keyboardOnly}
                  onChange={() => setSetting('keyboardOnly', !settings.keyboardOnly)}
                  label="Toggle onscreen keyboard only"
                />
              </Row>
            </Reveal>

            {/* Appearance */}
            <Reveal as="section" id="appearance" className="scroll-mt-20">
              <SectionHead eyebrow="02" title="Appearance" className="mb-4" />
              <Row title="Theme" description="System follows your device; Dark is the warm-black palette.">
                <div role="radiogroup" aria-label="Theme" className="flex gap-1.5">
                  {THEME_OPTIONS.map((opt) => {
                    const active = settings.theme === opt;
                    return (
                      <Button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        variant={active ? 'ink' : 'secondary'}
                        size="sm"
                        onClick={() => setSetting('theme', opt)}
                      >
                        {opt}
                      </Button>
                    );
                  })}
                </div>
              </Row>
            </Reveal>

            {/* Notifications */}
            <NotificationsSection />

            {/* Accessibility */}
            <Reveal as="section" id="accessibility" className="scroll-mt-20">
              <SectionHead eyebrow="04" title="Accessibility" className="mb-4" />
              <Row title="High contrast mode" description="Contrast and colour-blindness improvements.">
                <Toggle
                  checked={settings.highContrast}
                  onChange={() => setSetting('highContrast', !settings.highContrast)}
                  label="Toggle high contrast mode"
                />
              </Row>
              <Row title="Reduced motion" description="Minimise animations throughout the app.">
                <Toggle
                  checked={settings.reducedMotion}
                  onChange={() => setSetting('reducedMotion', !settings.reducedMotion)}
                  label="Toggle reduced motion"
                />
              </Row>

              {settings.highContrast && (
                <div className="rule-hair py-5">
                  <Label className="block mb-3">colour preview</Label>
                  <div className="flex gap-2">
                    {([
                      ['A', 'correct', 'Correct position colour: orange'],
                      ['B', 'present', 'Wrong position colour: blue'],
                      ['C', 'absent', 'Not in word colour: grey'],
                    ] as const).map(([ch, st, label]) => (
                      <div
                        key={st}
                        className="w-11 h-11 flex items-center justify-center font-display font-black text-base"
                        style={{
                          backgroundColor: `var(--tile-${st})`,
                          color: st === 'absent' ? 'var(--tile-absent-text)' : '#fff',
                        }}
                        role="img"
                        aria-label={label}
                      >
                        {ch}
                      </div>
                    ))}
                  </div>
                  <p className="font-mono text-xs text-text-secondary mt-3">
                    orange = correct position · blue = wrong position · grey = not in word
                  </p>
                </div>
              )}
            </Reveal>

            {/* Security */}
            <SecuritySection />

            {/* Privacy */}
            <PrivacySection />

            {/* Danger zone — the one wash on the page */}
            <Reveal as="section" id="danger" className="scroll-mt-20">
              <SectionHead eyebrow="07" title="Danger" aside="Irreversible actions." className="mb-4" />
              <div className="bg-wash-accent -mx-4 md:mx-0 px-4 md:px-6 py-2 mt-5">
                <Row title="Delete all game data" description="Erase all past games. Your ELO rating will be preserved.">
                  <Button type="button" variant="danger" size="sm" onClick={() => setShowDeleteGamesModal(true)}>
                    Delete games
                  </Button>
                </Row>
                {gamesDeletedBanner && (
                  <div className="pb-3">
                    <SuccessNote>All game data deleted. ELO preserved.</SuccessNote>
                  </div>
                )}
                <Row title="Delete account" description="Permanently delete your account and all associated data.">
                  <Button type="button" variant="danger" size="sm" onClick={() => setShowDeleteAccountModal(true)}>
                    Delete account
                  </Button>
                </Row>
              </div>
            </Reveal>
          </div>
        </div>
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
