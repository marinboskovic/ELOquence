'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import type { EloHistoryEntry } from '@/lib/types';
import { useViewMode } from '@/lib/viewMode';
import { ButtonLink, Hint, Label, Reveal } from '@/components/ui';
import EloSparkline from '@/components/EloSparkline';
import { Skeleton } from './shared';

interface Props {
  history: EloHistoryEntry[];
  loadingHistory?: boolean;
  isOwner: boolean;
  /** The "How you play" section (PaceHabits), already configured by the parent. */
  habits: React.ReactNode;
}

/**
 * Rating over time + How you play. In Simple view these sit behind one
 * "Show the numbers" rule so the page stays short; in Detailed view they
 * are always open.
 */
export default function NumbersBlock({ history, loadingHistory = false, isOwner, habits }: Props) {
  const { detailed } = useViewMode();
  const [open, setOpen] = useState(false);
  const shown = detailed || open;

  const content = (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8">
      <Reveal as="section" aria-label="Rating over time" className="md:col-span-7 min-w-0">
        <div className="rule-top pt-3 flex items-end justify-between gap-4">
          <div>
            <Label className="block mb-1">
              <Hint term="rating">rating</Hint>
            </Label>
            <h2 className="font-display text-display-sm text-text-primary">{isOwner ? 'Your rating over time' : 'Rating over time'}</h2>
          </div>
          {history.length > 1 && (
            <span className="font-mono text-xs tabular text-text-tertiary">
              {isOwner ? `last 90 days · ${history.length} game${history.length === 1 ? '' : 's'}` : `last ${history.length} games`}
            </span>
          )}
        </div>
        <div className="mt-4">
          {loadingHistory ? (
            <Skeleton className="w-full" style={{ height: 180 }} />
          ) : history.length >= 1 ? (
            <>
              <EloSparkline data={history} height={180} />
              <p className="text-xs text-text-secondary mt-2">Only Ranked games move the line. A dotted line is the next level up.</p>
            </>
          ) : (
            <div className="rule-hair pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-sm text-text-secondary">
                {isOwner ? 'No Ranked games yet — play one and the line starts here.' : 'No Ranked games yet.'}
              </p>
              {isOwner && (
                <ButtonLink href="/play" variant="secondary" size="sm" className="shrink-0">
                  play ranked
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </Reveal>
      <div className="md:col-span-5 min-w-0">{habits}</div>
    </div>
  );

  if (detailed) return content;

  return (
    <section aria-label="The numbers" className="flex flex-col gap-8">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="profile-numbers"
        onClick={() => setOpen((v) => !v)}
        className="rule-top pt-3 w-full flex items-center justify-between gap-4 text-left group"
      >
        <span>
          <Label className="block mb-1">more</Label>
          <span className="font-display text-display-sm text-text-primary ink-link">{open ? 'Hide the numbers' : 'Show the numbers'}</span>
        </span>
        <span className="inline-flex items-center gap-2 font-mono text-label uppercase text-text-secondary group-hover:text-text-primary transition-colors duration-fast">
          <span className="hidden sm:inline">rating over time · how {isOwner ? 'you' : 'they'} play</span>
          <ChevronDown size={16} className={clsx('transition-transform duration-fast', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {shown && (
          <motion.div
            id="profile-numbers"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
