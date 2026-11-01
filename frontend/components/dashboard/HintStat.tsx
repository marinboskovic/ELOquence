'use client';
/**
 * The UI kit's <Stat> with a ReactNode label, so a <Hint> can sit in the
 * mono micro-label ("Usual guesses", "Accuracy"…). Same markup and classes
 * as components/ui Stat — keep them in step.
 */
import clsx from 'clsx';
import { CountUp, Label } from '@/components/ui';

export default function HintStat({
  label,
  value,
  sub,
  size = 'md',
  className,
  count = true,
}: {
  label: React.ReactNode;
  value: number | string;
  sub?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  count?: boolean;
}) {
  const sizeCls = size === 'lg' ? 'text-display-lg' : size === 'sm' ? 'text-display-sm' : 'text-display-md';
  return (
    <div className={clsx('rule-hair pt-3 min-w-0', className)}>
      <Label className="block">{label}</Label>
      <div className={clsx('font-display text-text-primary tabular mt-1', sizeCls)}>
        {typeof value === 'number' && count ? <CountUp value={value} /> : value}
      </div>
      {sub && <div className="text-xs text-text-secondary mt-1">{sub}</div>}
    </div>
  );
}
