'use client';
import { Suspense, useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { errorMessage } from '@/lib/api';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AuthError, AuthField, AuthShell, AuthSubmit, OrDivider, safeNext } from '@/components/auth/AuthShell';

function RegisterInner() {
  const { register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get('next'));
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(username)) {
      setError('Username: 3–30 letters, digits, _ or -.');
      return;
    }
    setLoading(true);
    try {
      const u = await register(email, username, password);
      router.push(u.is_admin ? '/admin' : next);
    } catch (err) {
      setError(errorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create Account"
      footer={
        <>
          Already have an account?{' '}
          <Link
            href={next !== '/play' ? `/login?next=${encodeURIComponent(next)}` : '/login'}
            className="text-text-secondary hover:text-text-primary font-medium transition-colors duration-150 underline underline-offset-2"
          >
            Sign in
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
        <AuthField
          id="username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
          autoComplete="username"
          placeholder="wordsmith"
          hint="Shown on leaderboards and your public profile."
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <AuthError message={error} />
        <AuthSubmit loading={loading} loadingLabel="Creating…">
          Create Account
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
