'use client';
/**
 * Small helpers shared by the profile page sections.
 */
import clsx from 'clsx';

export type TierTone = 'neutral' | 'ochre' | 'green' | 'ink';
export function tierTone(name: string): TierTone {
  if (name === 'Veteran') return 'ochre';
  if (name === 'Master') return 'green';
  if (name === 'Grandmaster') return 'ink';
  return 'neutral';
}

/** "today", "yesterday", "3d ago", "mar 4". */
export function formatWhen(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();
}

export function formatMMSS(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return '—';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={clsx('skeleton bg-bg-muted', className)} style={style} aria-hidden="true" />;
}
