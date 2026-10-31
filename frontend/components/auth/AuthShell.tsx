'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { springs } from '@/lib/animations';

/** Card layout shared by every sign-in style page (login, register, reset…). */
export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-52px)] px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={springs.modal} className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <Link
            href="/"
            className="font-display font-black text-xl text-text-primary tracking-tight transition-opacity duration-150 hover:opacity-70"
            aria-label="ELOquence home"
          >
            ELOquence
          </Link>
        </div>
        <div className="bg-bg-base border border-border-default rounded-card-lg p-8" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          <h1 className="font-display font-black text-3xl tracking-tight text-text-primary mb-8">{title}</h1>
          {children}
          {footer && <div className="mt-6 text-center text-sm text-text-secondary">{footer}</div>}
        </div>
      </motion.div>
    </div>
  );
}

export function AuthField({
  id,
  label,
  hint,
  ...input
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        {label}
      </label>
      <input
        id={id}
        {...input}
        className="bg-transparent border-2 border-border-default focus:border-tile-correct focus:outline-none rounded-md px-3.5 py-3 text-base text-text-primary placeholder:text-text-tertiary transition-colors duration-150"
      />
      {hint && <p className="text-[11px] text-text-tertiary">{hint}</p>}
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
      className="flex items-center gap-2 text-sm"
      style={{ color: 'var(--red)' }}
      role="alert"
    >
      <AlertCircle size={14} aria-hidden="true" className="flex-shrink-0" />
      {message}
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
      className="flex items-center gap-2 text-sm"
      style={{ color: 'var(--green)' }}
      role="status"
    >
      <CheckCircle2 size={14} aria-hidden="true" className="flex-shrink-0" />
      {message}
    </motion.p>
  );
}

export function AuthSubmit({ loading, children, loadingLabel }: { loading: boolean; children: React.ReactNode; loadingLabel: string }) {
  return (
    <motion.button
      type="submit"
      disabled={loading}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      className="w-full bg-tile-correct text-white font-bold uppercase tracking-wider rounded-md py-3.5 mt-1 text-sm transition-[filter,transform] duration-150 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
    >
      {loading ? (
        <>
          <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          {loadingLabel}
        </>
      ) : (
        children
      )}
    </motion.button>
  );
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3">
      <div className="flex-1 h-px bg-border-subtle" />
      <span className="text-xs text-text-secondary">or</span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  );
}

/** Only relative, same-origin paths are accepted as a post-login target. */
export function safeNext(value: string | null | undefined, fallback = '/play'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
