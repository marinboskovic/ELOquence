'use client';
import { motion } from 'framer-motion';
import { patternToTiles, TileState } from '@/lib/types';
import { CountUp, Label, SectionHead, Tag } from '@/components/ui';
import clsx from 'clsx';

/** Pure CSS-var colours for revealed mini tiles (colour-blind safe). */
const TILE_FILL: Record<TileState, string> = {
  correct: 'var(--tile-correct)',
  present: 'var(--tile-present)',
  absent:  'var(--tile-absent)',
  empty:   'var(--tile-empty-bg)',
  tbd:     'var(--tile-empty-bg)',
};

function fgFor(state: TileState): string {
  if (state === 'absent') return 'var(--tile-absent-text)';
  if (state === 'empty' || state === 'tbd') return 'var(--text-primary)';
  return '#fff';
}

/**
 * A 5-tile pattern row at "mini" scale. With `letters` it becomes a tiny
 * finished Wordle row; without, it is the pure feedback pattern used in
 * bucket lists.
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
          className="flex items-center justify-center font-display font-black uppercase select-none"
          style={{
            width: size,
            height: size,
            backgroundColor: TILE_FILL[state],
            color: fgFor(state),
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
  const hollow = state === 'empty' || state === 'tbd';
  return (
    <div className={clsx('flex shrink-0', className)} style={{ gap: Math.max(2, Math.round(size * 0.12)) }} aria-label={word}>
      {word.split('').map((ch, i) => (
        <div
          key={i}
          className="flex items-center justify-center font-display font-black uppercase select-none"
          style={{
            width: size,
            height: size,
            backgroundColor: TILE_FILL[state],
            border: hollow ? '1.5px solid var(--tile-empty-border)' : undefined,
            color: fgFor(state),
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


/**
 * Headline number: hair rule + mono label + display number. Numeric values
 * count up on first view (the Lab's "prints in" moment); strings render as-is.
 */
export function StatTile({
  label,
  value,
  decimals,
  prefix,
  unit,
  sub,
  accent,
  delay = 0,
}: {
  /** mono micro-label; may wrap a `<Hint>` */
  label: React.ReactNode;
  value: string | number;
  /** decimals for numeric count-up */
  decimals?: number;
  /** text printed before the number (e.g. "#", "top ") */
  prefix?: string;
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
      transition={{ duration: 0.3, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className="rule-hair pt-3 min-w-0 flex flex-col gap-1"
    >
      <Label className="block">{label}</Label>
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="font-display text-display-md tabular text-text-primary truncate" style={accent ? { color: accent } : undefined}>
          {prefix}
          {typeof value === 'number' ? <CountUp value={value} decimals={decimals} /> : value}
        </span>
        {unit && <span className="font-mono text-xs text-text-secondary shrink-0">{unit}</span>}
      </div>
      {sub && <span className="font-sans text-xs text-text-tertiary leading-tight">{sub}</span>}
    </motion.div>
  );
}

/** Results section: a 2px rule with a SectionHead, no box. */
export function LabCard({
  title,
  eyebrow,
  aside,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode;
  eyebrow?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={clsx('min-w-0', className)}>
      {title ? (
        <SectionHead
          eyebrow={eyebrow}
          title={<span className="text-display-sm font-display">{title}</span>}
          aside={aside ? <span className="font-mono text-[11px] text-text-tertiary">{aside}</span> : undefined}
          className="pb-3"
        />
      ) : (
        <div className="rule-top" />
      )}
      <div className={padded ? 'pt-3' : undefined}>{children}</div>
    </section>
  );
}

/** Small square marking "this word is a possible answer". */
export function AnswerDot({ on, title = 'Possible answer' }: { on: boolean; title?: string }) {
  return (
    <span
      className="inline-block w-2 h-2 shrink-0"
      style={{
        backgroundColor: on ? 'var(--tile-correct)' : 'transparent',
        border: on ? undefined : '1px solid var(--border-subtle)',
      }}
      title={on ? title : 'Not in the answer list'}
      aria-label={on ? title : 'Not in the answer list'}
    />
  );
}

/** Rectangular tag (the kit's Tag), optionally clickable. */
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
  const t = tone === 'green' ? 'green' : tone === 'yellow' ? 'ochre' : 'neutral';
  const tag = (
    <Tag tone={active ? 'ink' : t} className={clsx(onClick && 'cursor-pointer', className)}>
      {children}
    </Tag>
  );
  if (onClick) {
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={onClick}
        className="inline-flex p-0 border-0 bg-transparent hover:-translate-y-0.5 transition-transform duration-fast"
        aria-pressed={active}
      >
        {tag}
      </motion.button>
    );
  }
  return tag;
}

/** 2px ink line on a hair track — the fill grows from 0 (scaleX, left origin). */
export function Bar({
  fraction,
  color = 'var(--tile-correct)',
  height = 2,
  delay = 0,
}: {
  fraction: number;
  color?: string;
  height?: number;
  delay?: number;
}) {
  const pct = Math.max(0, Math.min(1, fraction));
  return (
    <div className="w-full relative" style={{ height: Math.max(height, 1) }}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-border-subtle" style={{ height: 1 }} aria-hidden="true" />
      <motion.div
        className="absolute inset-y-0 left-0 w-full origin-left"
        style={{ backgroundColor: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: pct }}
        transition={{ duration: 0.6, delay, ease: [0.2, 0.8, 0.2, 1] }}
      />
    </div>
  );
}

/** Inline error line. */
export function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="font-mono text-xs" style={{ color: 'var(--red)' }}>
      {message}
    </p>
  );
}

export function formatInt(n: number): string {
  return n.toLocaleString('en-US');
}
