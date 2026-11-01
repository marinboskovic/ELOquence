'use client';
/**
 * Atelier UI kit — the shared primitives every page composes from.
 * Styling rules live in DESIGN.md; keep this file the single source for
 * button / tag / stat / section-head markup so pages stay consistent.
 */
import { forwardRef, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useInView, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';

/* ───────────────────────── Buttons ───────────────────────── */

type Variant = 'primary' | 'secondary' | 'ink' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink border-2 border-accent hover:shadow-ink',
  secondary: 'bg-transparent text-text-primary border-2 border-border-default hover:shadow-ink',
  ink: 'bg-bg-ink text-text-on-ink border-2 border-border-default hover:shadow-ink',
  ghost: 'bg-transparent text-text-secondary border-2 border-transparent hover:text-text-primary hover:border-border-subtle',
  danger: 'bg-transparent border-2 hover:shadow-ink',
};
const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3 text-[11px]',
  md: 'h-11 px-5 text-xs',
  lg: 'h-14 px-7 text-sm',
};

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', className?: string) =>
  clsx(
    'inline-flex items-center justify-center gap-2 font-mono font-semibold uppercase tracking-[0.14em] select-none cursor-pointer',
    'transition-[transform,box-shadow,background-color,color,border-color] duration-fast ease-out',
    'hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0 active:translate-y-0 active:shadow-none',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-none',
    VARIANT[variant],
    SIZE[size],
    className
  );

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, style, ...rest },
  ref
) {
  const dangerStyle = variant === 'danger' ? { color: 'var(--red)', borderColor: 'var(--red)', ...style } : style;
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} style={dangerStyle} {...rest}>
      {loading && <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  variant?: Variant;
  size?: Size;
}
export function ButtonLink({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* ───────────────────────── Labels & tags ───────────────────────── */

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={clsx('font-mono text-label uppercase text-text-secondary', className)}>{children}</span>;
}

type Tone = 'neutral' | 'green' | 'ochre' | 'accent' | 'ink';
const TONE: Record<Tone, string> = {
  neutral: 'border-border-subtle text-text-secondary',
  green: 'bg-wash-green border-transparent text-text-primary',
  ochre: 'bg-wash-ochre border-transparent text-text-primary',
  accent: 'bg-accent-soft border-transparent text-text-primary',
  ink: 'bg-bg-ink border-transparent text-text-on-ink',
};
export function Tag({ children, tone = 'neutral', className, dot }: { children: React.ReactNode; tone?: Tone; className?: string; dot?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 h-6 px-2 border font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap', TONE[tone], className)}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} aria-hidden="true" />}
      {children}
    </span>
  );
}

/* ───────────────────────── Section head ───────────────────────── */

export function SectionHead({
  eyebrow,
  title,
  aside,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('rule-top pt-3 flex items-end justify-between gap-4 flex-wrap', className)}>
      <div>
        {eyebrow && <Label className="block mb-1">{eyebrow}</Label>}
        <h2 className="font-display text-display-md text-text-primary">{title}</h2>
      </div>
      {aside && <div className="text-sm text-text-secondary">{aside}</div>}
    </div>
  );
}

/* ───────────────────────── Stat ───────────────────────── */

export function Stat({
  label,
  value,
  sub,
  size = 'md',
  className,
  count = true,
}: {
  label: string;
  value: number | string;
  sub?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** animate numeric values on first view */
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

/* ───────────────────────── Motion helpers ───────────────────────── */

/** Count a number up on first view (800ms, ease-out). Respects reduced motion. */
export function CountUp({ value, decimals, duration = 800, format }: { value: number; decimals?: number; duration?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration, reduced]);

  const text = format ? format(shown) : shown.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return <span ref={ref}>{text}</span>;
}

/** Rise-and-fade on enter (page sections). */
export function Reveal({ children, delay = 0, className, as = 'div', once = true, ...rest }: HTMLMotionProps<'div'> & { delay?: number; once?: boolean; as?: 'div' | 'section' | 'li' }) {
  const Comp = (motion as unknown as Record<string, typeof motion.div>)[as] ?? motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-8% 0px' }}
      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay }}
      className={className}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Headline whose words rise in one after another. */
export function SplitWords({ text, className, delay = 0, as: Tag = 'h1' }: { text: string; className?: string; delay?: number; as?: 'h1' | 'h2' | 'p' }) {
  const words = text.split(' ');
  return (
    <Tag className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pr-[0.22em] last:pr-0">
          <motion.span
            className="inline-block"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: delay + i * 0.045 }}
            aria-hidden="true"
          >
            {w}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

/** Stagger container for lists. */
export const staggerParent = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};
export const staggerChild = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.2, 0.8, 0.2, 1] } },
};

/* ───────────────────────── Mini tiles ───────────────────────── */

export function MiniTiles({ word, states, size = 22, gap = 3, className }: { word: string; states?: ('correct' | 'present' | 'absent' | 'empty')[]; size?: number; gap?: number; className?: string }) {
  const letters = word.split('');
  return (
    <span className={clsx('inline-flex', className)} style={{ gap }} aria-label={word}>
      {letters.map((ch, i) => {
        const st = states?.[i] ?? 'absent';
        const bg = st === 'empty' ? 'transparent' : `var(--tile-${st})`;
        const fg = st === 'absent' ? 'var(--tile-absent-text)' : st === 'empty' ? 'var(--text-primary)' : '#fff';
        return (
          <span
            key={i}
            className="inline-flex items-center justify-center font-display font-black uppercase"
            style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.55, lineHeight: 1, border: st === 'empty' ? '1.5px solid var(--tile-empty-border)' : 'none' }}
            aria-hidden="true"
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export function PatternRow({ pattern, size = 10, gap = 2 }: { pattern: number; size?: number; gap?: number }) {
  const cells: string[] = [];
  let p = pattern;
  for (let i = 0; i < 5; i++) {
    const v = p % 3;
    cells.push(v === 2 ? 'var(--tile-correct)' : v === 1 ? 'var(--tile-present)' : 'var(--tile-absent)');
    p = Math.floor(p / 3);
  }
  return (
    <span className="inline-flex" style={{ gap }} aria-hidden="true">
      {cells.map((c, i) => (
        <span key={i} style={{ width: size, height: size, background: c, display: 'inline-block' }} />
      ))}
    </span>
  );
}
