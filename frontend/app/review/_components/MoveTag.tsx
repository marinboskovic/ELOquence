'use client';
/**
 * A classification as a Tag. Same markup as `Tag` in components/ui, but the
 * "bad" tone sits on the coral wash (`bg-wash-accent`), which the shared Tag
 * does not offer. Labels always come from MOVE_CLASS.
 */
import clsx from 'clsx';
import { MOVE_CLASS } from '@/lib/copy';
import type { Classification } from '@/lib/types';
import { moveTone } from './takeaway';

export default function MoveTag({ classification, className }: { classification: Classification; className?: string }) {
  const tone = moveTone(classification);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 h-6 px-2 border font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap',
        tone === 'green' && 'bg-wash-green border-transparent text-text-primary',
        tone === 'bad' && 'bg-wash-accent border-transparent text-text-primary',
        tone === 'neutral' && 'border-border-subtle text-text-secondary',
        className
      )}
    >
      {MOVE_CLASS[classification].label}
    </span>
  );
}
