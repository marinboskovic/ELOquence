'use client';
import { useState, FormEvent } from 'react';
import { authApi } from '@/lib/api';
import { AuthError, AuthField, AuthLink, AuthShell, AuthSubmit, AuthSuccess, authErrorMessage } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(authErrorMessage(err, "Couldn't send the email. Try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Forgot your password?"
      eyebrow="sign in"
      manifesto="Forgot the word? It happens to the best of us."
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <AuthSuccess message="Check your inbox. If that email has an account, a link is on its way." />
          <p className="text-sm text-text-secondary leading-relaxed">
            The link works for 30 minutes. Nothing there? Look in spam. If you signed up with Google, there is no password
            to reset — just sign in with Google.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <p className="text-sm text-text-secondary leading-relaxed -mt-4">
            Type the email you signed up with. We&apos;ll send you a link to choose a new password.
          </p>
          <AuthField
            id="email"
            label="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
          <AuthError message={error} />
          <AuthSubmit loading={loading} loadingLabel="Sending…">
            Email me a link
          </AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
}
