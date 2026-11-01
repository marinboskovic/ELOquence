'use client';
import { useState, FormEvent } from 'react';
import { authApi, errorMessage } from '@/lib/api';
import { AuthError, AuthField, AuthLink, AuthShell, AuthSubmit, AuthSuccess } from '@/components/auth/AuthShell';

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
      setError(errorMessage(err, 'Could not send the reset e-mail. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      eyebrow="account · reset"
      manifesto="Forgot the word? It happens to the best of us."
      footer={<AuthLink href="/login">Back to sign in</AuthLink>}
    >
      {done ? (
        <div className="flex flex-col gap-4">
          <AuthSuccess message="If an account exists for that e-mail, a reset link is on its way." />
          <p className="text-sm text-text-secondary leading-relaxed">
            The link works for 30 minutes. Didn&apos;t get anything? Check your spam folder, or make sure you signed up with
            a password rather than Google.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <p className="text-sm text-text-secondary leading-relaxed -mt-4">
            Enter the e-mail you signed up with and we&apos;ll send you a link to choose a new password.
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
            Send reset link
          </AuthSubmit>
        </form>
      )}
    </AuthShell>
  );
}
