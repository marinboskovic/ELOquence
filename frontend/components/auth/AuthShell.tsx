'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import Tile from '@/components/Tile';
import { Button, Label, SplitWords } from '@/components/ui';
import type { TileState } from '@/lib/types';

/**
 * Editorial two-column spread for every sign-in style page.
 *
 *   ┌───────────────────────┬──────────────────────┐
 *   │ wash-green panel      │ paper                │
 *   │ wordmark              │ eyebrow + h1         │
 *   │ one-line manifesto    │ form                 │
 *   │ E N T E R  (tiles)    │ footer               │
 *   └───────────────────────┴──────────────────────┘
 *
 * Collapses to a single column (panel on top, short) on mobile.
 */

const WORD = 'ENTER';
const STATES: TileState[] = ['correct', 'absent', 'present', 'correct', 'tbd'];

export function AuthShell({
  title,
  eyebrow = 'account',
  manifesto = 'Five letters. Six tries. One rating.',
  children,
  footer,
}: {
  title: string;
  eyebrow?: string;
  manifesto?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-page grid grid-cols-1 md:grid-cols-12">
      {/* ── Left: wash panel ─────────────────────────────── */}
      <aside className="md:col-span-5 lg:col-span-6 bg-wash-green flex flex-col justify-between px-4 md:px-8 lg:px-12 py-8 md:py-12">
        <Link
          href="/"
          className="font-display font-black text-xl tracking-tight text-text-primary self-start ink-link"
          aria-label="ELOquence home"
        >
          ELOquence
        </Link>

        <div className="hidden md:flex flex-col gap-8 py-12">
          <p className="font-display text-display-md text-text-primary max-w-md text-balance">{manifesto}</p>
          <div className="flex" style={{ gap: 'var(--tile-gap)' }} role="img" aria-label={WORD}>
            {WORD.split('').map((ch, i) => (
              <Tile key={i} letter={ch} state={STATES[i]} position={i} size="clamp(44px, 5vw, 64px)" />
            ))}
          </div>
        </div>

        {/* Mobile: a compact tile row under the wordmark */}
        <div className="md:hidden mt-6 flex" style={{ gap: 4 }} role="img" aria-label={WORD}>
          {WORD.split('').map((ch, i) => (
            <Tile key={i} letter={ch} state={STATES[i]} position={i} size="28px" />
          ))}
        </div>

        <Label className="hidden md:block">eloquence · wordle, rated</Label>
      </aside>

      {/* ── Right: the form on paper ─────────────────────── */}
      <main className="md:col-span-7 lg:col-span-6 flex items-center px-4 md:px-8 lg:px-16 py-10 md:py-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
          className="w-full max-w-sm mx-auto md:mx-0"
        >
          <Label className="block mb-2">{eyebrow}</Label>
          <SplitWords text={title} as="h1" className="font-display text-display-lg text-text-primary mb-10" />
          {children}
          {footer && <div className="mt-8 rule-hair pt-5 text-sm text-text-secondary">{footer}</div>}
        </motion.div>
      </main>
    </div>
  );
}

export function AuthField({
  id,
  label,
  hint,
  className,
  ...input
}: { id: string; label: string; hint?: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id}>
        <Label>{label}</Label>
      </label>
      <input
        id={id}
        {...input}
        className={[
          'w-full border-0 border-b-2 border-border-default focus:border-accent bg-transparent px-0 py-3',
          'text-base text-text-primary placeholder:text-text-ghost outline-none transition-colors duration-fast',
          'disabled:opacity-40',
          className ?? '',
        ].join(' ')}
      />
      {hint && <p className="text-xs text-text-tertiary mt-1">{hint}</p>}
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-2 text-sm text-accent"
      role="alert"
    >
      <AlertCircle size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </motion.p>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  if (!message) return null;
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-2 text-sm text-text-primary"
      role="status"
    >
      <CheckCircle2 size={16} aria-hidden="true" className="flex-shrink-0 mt-0.5" style={{ color: 'var(--tile-correct)' }} />
      <span>{message}</span>
    </motion.p>
  );
}

export function AuthSubmit({ loading, children, loadingLabel }: { loading: boolean; children: React.ReactNode; loadingLabel: string }) {
  return (
    <Button type="submit" size="lg" className="w-full mt-2" loading={loading}>
      {loading ? loadingLabel : children}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="my-7 flex items-center gap-4" role="separator" aria-label="or">
      <div className="flex-1 h-px bg-border-subtle" />
      <Label>or</Label>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

/** Tertiary ink-link used in auth footers. */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="ink-link text-text-primary font-medium">
      {children}
    </Link>
  );
}

/** Only relative, same-origin paths are accepted as a post-login target. */
export function safeNext(value: string | null | undefined, fallback = '/play'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
