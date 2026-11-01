'use client';
/**
 * Shared Atelier bits for the admin pages (not a route — the leading
 * underscore keeps Next from treating this file as one).
 */
import Link from 'next/link';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import TileSpinner from '@/components/TileSpinner';
import AdminNav from '@/components/admin/AdminNav';
import { Button, Label, SplitWords, Tag } from '@/components/ui';

/* ── Page shell: eyebrow + h1 + aside, then the tab strip ─────────── */

export function AdminPage({
  eyebrow,
  title,
  aside,
  crumbs,
  children,
  width = 'max-w-6xl',
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
  /** Optional trail rendered above the eyebrow, e.g. [['Users', '/admin/users']]. */
  crumbs?: Array<[string, string]>;
  children: React.ReactNode;
  width?: string;
}) {
  return (
    <div className={clsx(width, 'mx-auto px-4 md:px-8 py-10 md:py-16')}>
      <header className="mb-6 md:mb-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-8">
          {crumbs && crumbs.length > 0 && (
            <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
              <Link href="/admin" className="ink-link hover:text-text-primary">admin</Link>
              {crumbs.map(([label, href]) => (
                <span key={href} className="flex items-center gap-2">
                  <span aria-hidden="true">/</span>
                  <Link href={href} className="ink-link hover:text-text-primary">{label}</Link>
                </span>
              ))}
            </nav>
          )}
          <Label className="block mb-2">{eyebrow}</Label>
          <SplitWords text={title} as="h1" className="font-display text-display-lg text-text-primary" />
        </div>
        {aside && <div className="md:col-span-4 md:justify-self-end">{aside}</div>}
      </header>
      <AdminNav />
      {children}
    </div>
  );
}

/* ── Loading / empty / error ──────────────────────────────────────── */

export function AdminLoading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center min-h-page">
      <TileSpinner size="md" label={label} />
    </div>
  );
}

export function PanelLoading({ label = 'Loading', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="border-b border-border-subtle py-3 flex items-center gap-4">
          <div className="skeleton bg-bg-muted h-4 w-32" />
          <div className="skeleton bg-bg-muted h-4 w-20 hidden sm:block" />
          <div className="skeleton bg-bg-muted h-4 w-12 ml-auto" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyBand({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-muted px-6 py-10">
      <p className="font-display text-display-sm text-text-primary">{children}</p>
    </div>
  );
}

export function ErrorBand({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div role="alert" aria-live="assertive" className="mb-6 bg-wash-accent px-4 py-3 flex items-center justify-between gap-4">
      <p className="flex items-start gap-2 text-sm text-text-primary">
        <AlertCircle size={15} className="shrink-0 mt-0.5 text-accent" aria-hidden="true" />
        <span>{children}</span>
      </p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="ink-link font-mono text-label uppercase text-text-primary shrink-0">
          dismiss
        </button>
      )}
    </div>
  );
}

/* ── Table atoms ──────────────────────────────────────────────────── */

export const TH = 'py-2 px-3 first:pl-0 last:pr-0 font-normal text-left';
export const TD = 'py-3 px-3 first:pl-0 last:pr-0 align-middle';
export const TR = 'border-b border-border-subtle hover:bg-bg-elevated transition-colors';

export function StatusTag({ status }: { status: string }) {
  const tone =
    status === 'won' ? 'green' : status === 'in_progress' ? 'ochre' : status === 'lost' ? 'accent' : 'neutral';
  return (
    <Tag tone={tone} dot={status === 'in_progress' ? 'var(--accent)' : undefined}>
      {status.replace('_', ' ')}
    </Tag>
  );
}

export function EloDelta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="font-mono tabular text-text-tertiary">—</span>;
  return (
    <span className={clsx('font-mono tabular font-semibold', delta > 0 ? 'text-text-primary' : delta < 0 ? 'text-text-secondary' : 'text-text-tertiary')}>
      {delta > 0 ? '+' : ''}
      {delta}
    </span>
  );
}

export function Pager({
  page,
  totalPages,
  onPrev,
  onNext,
  note,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
  note?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-6 rule-hair pt-4 flex items-center justify-between gap-4">
      <span className="font-mono text-xs text-text-secondary tabular">
        page {page} / {totalPages}
        {note ? ` · ${note}` : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onPrev} disabled={page === 1} aria-label="Previous page">
          <ChevronLeft size={14} />
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onNext} disabled={page === totalPages} aria-label="Next page">
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

/* ── Form atoms ───────────────────────────────────────────────────── */

export const INPUT =
  'w-full border-0 border-b-2 border-border-default focus:border-accent bg-transparent px-0 py-2.5 text-sm text-text-primary placeholder:text-text-ghost outline-none transition-colors duration-fast disabled:opacity-40';

export const SELECT =
  'w-full border-0 border-b-2 border-border-default focus:border-accent bg-transparent px-0 py-2.5 pr-6 text-sm text-text-primary outline-none transition-colors duration-fast cursor-pointer';

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <Label className="block mb-1">{label}</Label>
      {children}
    </label>
  );
}

/** Section head for admin panels: hair rule, mono eyebrow, display-sm title. */
export function PanelHead({ title, aside, className }: { title: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rule-top pt-3 mb-4 flex items-end justify-between gap-4 flex-wrap', className)}>
      <h2 className="font-display text-display-sm text-text-primary">{title}</h2>
      {aside && <div className="font-mono text-xs text-text-secondary tabular">{aside}</div>}
    </div>
  );
}
