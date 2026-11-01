'use client';
import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { AuthError, AuthField, AuthLink, AuthShell, AuthSubmit } from '@/components/auth/AuthShell';

function ResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { adoptTokens } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(token ? '' : 'This reset link is missing its token. Request a new one.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, password);
      await adoptTokens(res.data);
      router.replace('/play');
    } catch (err) {
      setError(errorMessage(err, 'This reset link is invalid or has expired.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="New password"
      eyebrow="account · reset"
      manifesto="A fresh start. Pick something you will remember."
      footer={<AuthLink href="/forgot-password">Request a new link</AuthLink>}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <AuthField
          id="password"
          label="new password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          disabled={!token}
        />
        <AuthField
          id="confirm"
          label="confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Same again"
          disabled={!token}
        />
        <AuthError message={error} />
        <AuthSubmit loading={loading} loadingLabel="Saving…">
          Set password
        </AuthSubmit>
        <p className="text-xs text-text-tertiary">You&apos;ll be signed out of every other device.</p>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
