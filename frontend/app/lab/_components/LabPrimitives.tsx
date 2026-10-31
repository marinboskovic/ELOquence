'use client';
import { motion } from 'framer-motion';
import { patternToTiles, TileState } from '@/lib/types';
import clsx from 'clsx';

/** Pure CSS-var colours for revealed mini tiles (colour-blind safe). */
const TILE_FILL: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent:  'var(--tile-absent)',
  empty:   'var(--tile-empty-bg)',
  tbd:     'var(--tile-empty-bg)',
};

/**
 * A 5-tile pattern row at "mini" scale. With `letters` it becomes a tiny
 * finished Wordle row (white uppercase letters on coloured squares); without,
 * it is the pure feedback pattern used in bucket lists.
 */
export function MiniPattern({
  pattern,
  letters,
  size = 20,
  className,
}: {
  pattern: number;
  letters?: string;
  size?: number;
  className?: string;
}) {
  const tiles = patternToTiles(pattern);
  const font = Math.max(8, Math.round(size * 0.55));
  return (
    <div className={clsx('flex shrink-0', className)} style={{ gap: Math.max(2, Math.round(size * 0.12)) }} aria-hidden="true">
      {tiles.map((state, i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded-sm font-sans font-bold uppercase select-none"
          style={{
            width: size,
            height: size,
            backgroundColor: TILE_FILL[state],
            color: '#ffffff',
            fontSize: font,
            lineHeight: 1,
          }}
        >
          {letters ? letters[i] ?? '' : ''}
        </div>
      ))}
    </div>
  );
}

/** A word spelled as uniform mini tiles in one state (e.g. all absent). */
export function MiniWord({
  word,
  state = 'absent',
  size = 20,
  className,
}: {
  word: string;
  state?: TileState;
  size?: number;
  className?: string;
}) {
  const font = Math.max(8, Math.round(size * 0.55));
  return (
    <div className={clsx('flex shrink-0', className)} style={{ gap: Math.max(2, Math.round(size * 0.12)) }} aria-label={word}>
      {word.split('').map((ch, i) => (
        <div
          key={i}
          className="flex items-center justify-center rounded-sm font-sans font-bold uppercase select-none"
          style={{
            width: size,
            height: size,
            backgroundColor: TILE_FILL[state],
            border: state === 'empty' || state === 'tbd' ? '1px solid var(--tile-empty-border)' : undefined,
            color: state === 'empty' || state === 'tbd' ? 'var(--text-primary)' : '#ffffff',
            fontSize: font,
            lineHeight: 1,
          }}
        >
          {ch}
        </div>
      ))}
    </div>
  );
}

/** Micro-label used above numbers and table columns. */
export function MicroLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx('font-sans text-[10px] uppercase tracking-wider text-text-secondary font-semibold', className)}>
      {children}
    </span>
  );
}

/** Headline number tile: label on top, big display number, optional sub-line. */
export function StatTile({
  label,
  value,
  unit,
  sub,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  unit?: string;
  sub?: React.ReactNode;
  /** CSS colour for the number (defaults to text-primary). */
  accent?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-2 p-4 rounded-card bg-bg-base border border-border-default min-w-0"
    >
      <MicroLabel>{label}</MicroLabel>
      <div className="flex items-baseline gap-1 min-w-0">
        <span
          className="font-display font-black tracking-tight text-2xl sm:text-3xl tabular-nums leading-none truncate"
          style={accent ? { color: accent } : undefined}
        >
          {value}
        </span>
        {unit && <span className="font-sans text-xs text-text-secondary shrink-0">{unit}</span>}
      </div>
      {sub && <span className="font-sans text-[11px] text-text-tertiary leading-tight">{sub}</span>}
    </motion.div>
  );
}

/** Card shell used for every results section. */
export function LabCard({
  title,
  aside,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={clsx('rounded-card-lg bg-bg-base border border-border-default overflow-hidden', className)}>
      {(title || aside) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-subtle">
          <span className="font-sans font-semibold text-sm text-text-primary">{title}</span>
          {aside && <span className="font-sans text-[11px] text-text-ghost text-right">{aside}</span>}
        </div>
      )}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  );
}

/** Small green dot marking "this word is a possible answer". */
export function AnswerDot({ on, title = 'Possible answer' }: { on: boolean; title?: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{
        backgroundColor: on ? 'var(--tile-correct)' : 'transparent',
        border: on ? undefined : '1px solid var(--border-default)',
      }}
      title={on ? title : 'Not in the answer list'}
      aria-label={on ? title : 'Not in the answer list'}
    />
  );
}

/** Pill chip (green tint by default). */
export function Chip({
  children,
  tone = 'green',
  onClick,
  active,
  className,
}: {
  children: React.ReactNode;
  tone?: 'green' | 'neutral' | 'yellow';
  onClick?: () => void;
  active?: boolean;
  className?: string;
}) {
  const color =
    tone === 'green' ? 'var(--tile-correct)' : tone === 'yellow' ? 'var(--tile-present)' : 'var(--text-secondary)';
  const style: React.CSSProperties = {
    background: `color-mix(in srgb, ${color} ${active ? 22 : 15}%, transparent)`,
    color: tone === 'neutral' ? 'var(--text-primary)' : color,
    borderColor: active ? color : 'transparent',
  };
  const cls = clsx(
    'inline-flex items-center gap-1.5 rounded-pill text-xs px-3 py-1 font-sans font-semibold border transition-colors',
    onClick && 'cursor-pointer hover:brightness-95',
    className
  );
  if (onClick) {
    return (
      <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onClick} className={cls} style={style} aria-pressed={active}>
        {children}
      </motion.button>
    );
  }
  return (
    <span className={cls} style={style}>
      {children}
    </span>
  );
}

/** Thin horizontal bar with a tile-correct fill — used for probabilities. */
export function Bar({ fraction, color = 'var(--tile-correct)', height = 8 }: { fraction: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, fraction * 100));
  return (
    <div className="w-full rounded-pill bg-bg-muted border border-border-subtle overflow-hidden" style={{ height }}>
      <motion.div
        className="h-full rounded-pill"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      />
    </div>
  );
}

/** Inline error line (red accent, no new colours). */
export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="font-sans text-sm font-medium text-center" style={{ color: 'var(--red)' }}>
      {message}
    </p>
  );
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}
