'use client';
/**
 * `Stat` from components/ui, but the label is a `<Hint>` so a beginner can
 * tap "Skill" and read what it means. (Stat's `label` prop is a plain string,
 * so this mirrors its markup rather than wrapping it.)
 */
import clsx from 'clsx';
import { CountUp, Hint, Label } from '@/components/ui';
import type { TermKey } from '@/lib/copy';

export default function HintStat({
  term,
  label,
  value,
  sub,
  size = 'md',
  className,
  count = true,
}: {
  /** key into TERMS — the hint's title and body */
  term: TermKey;
  /** override the visible label (defaults to the term's name) */
  label?: string;
  value: number | string;
  sub?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  count?: boolean;
}) {
  const sizeCls = size === 'lg' ? 'text-display-lg' : size === 'sm' ? 'text-display-sm' : 'text-display-md';
  return (
    <div className={clsx('rule-hair pt-3 min-w-0', className)}>
      <Label className="block">
        <Hint term={term}>{label}</Hint>
      </Label>
      <div className={clsx('font-display text-text-primary tabular mt-1', sizeCls)}>
        {typeof value === 'number' && count ? <CountUp value={value} /> : value}
      </div>
      {sub && <div className="text-xs text-text-secondary mt-1 max-w-[28ch]">{sub}</div>}
    </div>
  );
}
