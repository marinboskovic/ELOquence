'use client';
/**
 * Atelier UI kit — the shared primitives every page composes from.
 * Styling rules live in DESIGN.md; keep this file the single source for
 * button / tag / stat / section-head markup so pages stay consistent.
 */
import { forwardRef, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useInView, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import clsx from 'clsx';
import { useViewMode } from '@/lib/viewMode';
import { TERMS, type TermKey } from '@/lib/copy';

/* ───────────────────────── Buttons ───────────────────────── */

type Variant = 'primary' | 'secondary' | 'ink' | 'ghost' | 'danger' | 'on-ink';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink border-2 border-accent hover:shadow-ink',
  secondary: 'bg-transparent text-text-primary border-2 border-border-default hover:shadow-ink',
  ink: 'bg-bg-ink text-text-on-ink border-2 border-border-default hover:shadow-ink',
  ghost: 'bg-transparent text-text-secondary border-2 border-transparent hover:text-text-primary hover:border-border-subtle',
  danger: 'bg-transparent border-2 hover:shadow-ink',
  // For buttons placed inside an ink block (inverted surface).
  'on-ink': 'bg-transparent text-text-on-ink border-2 border-[var(--text-on-ink)] hover:bg-[var(--text-on-ink)] hover:text-[var(--bg-ink)]',
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
  // A colour passed in (e.g. text-text-on-ink on an ink band) must win; with both classes
  // present the stylesheet order decided, and the default grey won on dark bands.
  const hasColour = /(^|\s)!?text-(text-|accent|cls-)/.test(className ?? '');
  return <span className={clsx('font-mono text-label uppercase', !hasColour && 'text-text-secondary', className)}>{children}</span>;
}

type Tone = 'neutral' | 'green' | 'ochre' | 'accent' | 'warn' | 'ink' | 'on-ink';
// Toned tags carry a translucent ink edge: on a wash section (dark mode especially) a
// wash-on-wash tag with no border disappeared, and the subtle hairline matched the wash.
const TONE: Record<Tone, string> = {
  neutral: 'border-[var(--tag-border)] text-text-secondary',
  green: 'bg-wash-green border-[var(--tag-border)] text-text-primary',
  ochre: 'bg-wash-ochre border-[var(--tag-border)] text-text-primary',
  accent: 'bg-accent-soft border-[var(--tag-border)] text-text-primary',
  // Danger-adjacent wash (the accent wash is green in light mode, so "bad" needs its own tone).
  warn: 'bg-wash-accent border-[var(--tag-border)] text-text-primary',
  ink: 'bg-bg-ink border-transparent text-text-on-ink',
  // Outlined tag for use inside an ink block (inverted surface).
  'on-ink': 'bg-transparent border-[var(--text-on-ink)] text-text-on-ink',
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

/**
 * "Has the user seen this yet?" — true once the element enters the viewport,
 * OR once it has been scrolled past (a fast fling can jump over a section
 * between two IntersectionObserver ticks, which would leave count-ups at 0
 * and reveals invisible forever). Checked on scroll, throttled to a frame.
 */
export function useSeen<T extends Element>(ref: React.RefObject<T>, margin = '-10% 0px') {
  const inView = useInView(ref, { once: true, margin: margin as never });
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    if (inView || passed) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top < window.innerHeight) setPassed(true);
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(check); };
    window.addEventListener('scroll', onScroll, { passive: true });
    const t = window.setTimeout(check, 1200); // safety net: never leave a number at 0 past ~1s
    return () => { window.removeEventListener('scroll', onScroll); window.clearTimeout(t); if (raf) cancelAnimationFrame(raf); };
  }, [inView, passed, ref]);
  return inView || passed;
}

/** Count a number up on first view (800ms, ease-out). Respects reduced motion. */
export function CountUp({ value, decimals, duration = 800, format }: { value: number; decimals?: number; duration?: number; format?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useSeen(ref);
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
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref, '-8% 0px');
  if (once) {
    return (
      <Comp
        ref={ref}
        initial={{ opacity: 0, y: 14 }}
        animate={seen ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
        transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1], delay }}
        className={className}
        {...rest}
      >
        {children}
      </Comp>
    );
  }
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
export function SplitWords({ text, className, style, delay = 0, as: Tag = 'h1' }: { text: string; className?: string; style?: CSSProperties; delay?: number; as?: 'h1' | 'h2' | 'p' }) {
  const words = text.split(' ');
  return (
    <Tag className={className} style={style} aria-label={text}>
      {words.map((w, i) => (
        // The mask needs room below the tight display line-height or descenders (g, p, y) get clipped;
        // the negative margin gives that room back so line spacing is unchanged.
        <span key={i} className="inline-block overflow-hidden align-bottom pr-[0.22em] last:pr-0 pb-[0.18em] -mb-[0.18em]">
          <motion.span
            className="inline-block"
            initial={{ y: '130%' }}
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

/* ───────────────────────── Beginner layer ─────────────────────────
   Hint    — a term with a plain-language explanation on hover/focus/tap.
   Detail  — renders children only in Detailed view (optional simple fallback).
   DetailToggle — the Simple | Detailed switch.
   All copy comes from lib/copy.ts so every screen says the same thing. */


export function Hint({
  term,
  title,
  body,
  children,
  className,
  side = 'top',
}: {
  /** key into TERMS — fills title/body unless overridden */
  term?: TermKey;
  title?: string;
  body?: string;
  /** the text the hint is attached to; defaults to the term's name */
  children?: React.ReactNode;
  className?: string;
  side?: 'top' | 'bottom';
}) {
  const t = term ? TERMS[term] : undefined;
  const { detailed } = useViewMode();
  const heading = title ?? t?.name ?? '';
  const text = body ?? (t ? (detailed ? t.detail : t.simple) : '');
  const [open, setOpen] = useState(false);
  const id = useRef(`hint-${Math.random().toString(36).slice(2, 8)}`).current;
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!text) return <>{children ?? heading}</>;

  return (
    <span ref={ref} className={clsx('relative inline-flex items-center', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex items-center gap-1 cursor-help text-inherit [font:inherit] [letter-spacing:inherit] [text-transform:inherit] border-b border-dotted border-current/60 hover:border-solid focus-visible:outline-none focus-visible:border-solid"
      >
        {children ?? heading}
      </button>
      <AnimatePresence>
        {open && (
          <motion.span
            id={id}
            role="tooltip"
            initial={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === 'top' ? 4 : -4 }}
            transition={{ duration: 0.16, ease: [0.2, 0.8, 0.2, 1] }}
            className={clsx(
              'absolute left-0 z-40 w-64 max-w-[80vw] bg-bg-ink text-text-on-ink p-3 shadow-ink normal-case tracking-normal text-left font-sans outline outline-1 outline-[var(--bg-base)]',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            )}
          >
            {heading && <span className="block font-mono text-[10px] uppercase tracking-[0.14em] opacity-70 mb-1">{heading}</span>}
            <span className="block text-xs leading-relaxed font-normal">{text}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Show `children` only in Detailed view; show `simple` (if given) otherwise. */
export function Detail({ children, simple }: { children: React.ReactNode; simple?: React.ReactNode }) {
  const { detailed } = useViewMode();
  return <>{detailed ? children : simple ?? null}</>;
}

/** Simple | Detailed segmented switch. */
export function DetailToggle({ className, size = 'sm' }: { className?: string; size?: 'sm' | 'md' }) {
  const { mode, setMode } = useViewMode();
  const h = size === 'sm' ? 'h-7 text-[10px]' : 'h-9 text-[11px]';
  return (
    <div role="group" aria-label="Level of detail" className={clsx('inline-flex border border-border-default', className)}>
      {(['simple', 'detailed'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={clsx(
            'px-3 font-mono uppercase tracking-[0.14em] transition-colors duration-fast',
            h,
            mode === m ? 'bg-bg-ink text-text-on-ink' : 'text-text-secondary hover:text-text-primary'
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
