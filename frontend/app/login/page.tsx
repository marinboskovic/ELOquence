'use client';
import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { errorMessage } from '@/lib/api';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AuthError, AuthField, AuthShell, AuthSubmit, OrDivider, safeNext } from '@/components/auth/AuthShell';

const GOOGLE_ERRORS: Record<string, string> = {
  google: 'Google sign-in failed. Please try again.',
  google_state: 'Google sign-in expired. Please try again.',
};

function LoginInner() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => GOOGLE_ERRORS[searchParams.get('error') || ''] || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const u = await login(email, password);
      router.push(u.is_admin ? '/admin' : next);
    } catch (err) {
      setError(errorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Sign In"
      footer={
        <>
          No account?{' '}
          <Link
            href={next !== '/play' ? `/register?next=${encodeURIComponent(next)}` : '/register'}
            className="text-text-secondary hover:text-text-primary font-medium transition-colors duration-150 underline underline-offset-2"
          >
            Create one free
          </Link>
        </>
      }
    >
      <GoogleSignInButton next={next} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
        <div className="flex flex-col gap-1.5">
          <AuthField
            id="password"
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Link
            href="/forgot-password"
            className="self-end text-xs text-text-secondary hover:text-text-primary underline underline-offset-2 transition-colors"
          >
            Forgot password?
          </Link>
        </div>
        <AuthError message={error} />
        <AuthSubmit loading={loading} loadingLabel="Signing in…">
          Sign In
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
