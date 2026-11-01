'use client';
import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { AuthError, AuthField, AuthLink, AuthShell, AuthSubmit, authErrorMessage } from '@/components/auth/AuthShell';

function ResetInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const { adoptTokens } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(token ? '' : 'This link is incomplete. Ask for a new one below.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token, password);
      await adoptTokens(res.data);
      router.replace('/play');
    } catch (err) {
      setError(authErrorMessage(err, 'This link has expired or was already used. Ask for a new one below.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Choose a new password"
      eyebrow="sign in"
      manifesto="A fresh start. Pick something you will remember."
      footer={<AuthLink href="/forgot-password">Ask for a new link</AuthLink>}
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
          placeholder="8 characters or more"
          disabled={!token}
        />
        <AuthField
          id="confirm"
          label="same password again"
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
          Save and sign in
        </AuthSubmit>
        <p className="text-xs text-text-secondary">You stay signed in here. Any other phone or computer is signed out.</p>
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
