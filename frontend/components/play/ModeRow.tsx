'use client';
/**
 * One board on the "Pick a board" list. Title + tag, then the mode's plain
 * tagline and note from lib/copy.ts, then an optional short status and arrow.
 * Rules, not cards (DESIGN.md §3).
 */
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { MODES } from '@/lib/copy';
import type { GameMode } from '@/lib/types';
import TileSpinner from '@/components/TileSpinner';
import { staggerChild } from '@/components/ui';

export interface ModeRowProps {
  mode: GameMode;
  /** Short state shown at the right ("continue", "sign in to play", a countdown). */
  status?: React.ReactNode;
  tag?: React.ReactNode;
  /** Something drawn next to the copy (e.g. today's pattern grid). */
  extra?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  locked?: boolean;
}

export default function ModeRow({ mode, status, tag, extra, onClick, disabled, loading, locked }: ModeRowProps) {
  const copy = MODES[mode];
  return (
    <motion.li variants={staggerChild} className="rule-hair">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-busy={loading || undefined}
        className={clsx(
          'group w-full text-left grid grid-cols-1 md:grid-cols-12 items-center gap-x-6 gap-y-3 py-7 md:py-8',
          'disabled:cursor-wait',
          locked && 'opacity-70 hover:opacity-100'
        )}
      >
        {/* Name + tag */}
        <div className="md:col-span-4 flex flex-wrap items-center gap-x-4 gap-y-2 min-w-0">
          <span className="font-display text-display-md text-text-primary transition-transform duration-fast ease-out group-hover:-translate-y-0.5">
            {copy.name}
          </span>
          {tag}
        </div>

        {/* Tagline + one plain note */}
        <div className="md:col-span-5 flex items-center gap-5 min-w-0">
          {extra}
          <span className="min-w-0">
            <span className="block text-sm text-text-primary leading-snug">{copy.tagline}</span>
            <span className="block text-sm text-text-secondary leading-snug mt-1">{copy.note}</span>
          </span>
        </div>

        {/* Status + arrow */}
        <div className="md:col-span-3 flex items-center md:justify-end gap-3 min-w-0">
          <span className="font-mono text-xs tabular text-text-secondary text-left md:text-right truncate">
            {loading ? <TileSpinner size="sm" label="Starting" /> : status}
          </span>
          <ArrowRight
            size={18}
            className="shrink-0 text-text-tertiary transition-[color,transform] duration-fast ease-out group-hover:text-accent group-hover:translate-x-1"
            aria-hidden="true"
          />
        </div>
      </button>
    </motion.li>
  );
}
