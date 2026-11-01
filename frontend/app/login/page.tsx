'use client';
import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AuthError, AuthField, AuthLink, AuthShell, AuthSubmit, OrDivider, authErrorMessage, safeNext } from '@/components/auth/AuthShell';

const GOOGLE_ERRORS: Record<string, string> = {
  google: "Google sign-in didn't work. Try again.",
  google_state: 'Google sign-in took too long. Try again.',
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
      setError(authErrorMessage(err, "That email and password don't match."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      eyebrow="sign in"
      manifesto="Pick up your streak where you left it."
      footer={
        <>
          New here?{' '}
          <AuthLink href={next !== '/play' ? `/register?next=${encodeURIComponent(next)}` : '/register'}>
            Create a free account
          </AuthLink>
        </>
      }
    >
      <GoogleSignInButton next={next} />
      {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && <OrDivider />}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
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
        <div className="flex flex-col gap-2">
          <AuthField
            id="password"
            label="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
          <Link href="/forgot-password" className="self-end ink-link text-xs text-text-secondary hover:text-text-primary">
            Forgot your password?
          </Link>
        </div>
        <AuthError message={error} />
        <AuthSubmit loading={loading} loadingLabel="Signing in…">
          Sign in
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
