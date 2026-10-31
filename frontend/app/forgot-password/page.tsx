'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { authApi, errorMessage } from '@/lib/api';
import { AuthError, AuthField, AuthShell, AuthSubmit, AuthSuccess } from '@/components/auth/AuthShell';

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
      title="Reset Password"
      footer={
        <Link href="/login" className="text-text-secondary hover:text-text-primary font-medium underline underline-offset-2 transition-colors">
          Back to sign in
        </Link>
      }
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <p className="text-sm text-text-secondary leading-relaxed -mt-3">
            Enter the e-mail you signed up with and we&apos;ll send you a link to choose a new password.
          </p>
          <AuthField
            id="email"
            label="Email"
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
