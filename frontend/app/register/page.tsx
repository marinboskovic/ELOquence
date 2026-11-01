'use client';
import { Suspense, useState, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { errorMessage } from '@/lib/api';
import GoogleSignInButton from '@/components/GoogleSignInButton';
import { AuthError, AuthField, AuthLink, AuthShell, AuthSubmit, OrDivider, safeNext } from '@/components/auth/AuthShell';

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
      title="Create account"
      eyebrow="account · register"
      manifesto="Every guess is a move. Every game is rated."
      footer={
        <>
          Already have an account?{' '}
          <AuthLink href={next !== '/play' ? `/login?next=${encodeURIComponent(next)}` : '/login'}>Sign in</AuthLink>
        </>
      }
    >
      <GoogleSignInButton next={next} />
      <OrDivider />
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
        <AuthField
          id="username"
          label="username"
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
          label="password"
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
          Create account
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
