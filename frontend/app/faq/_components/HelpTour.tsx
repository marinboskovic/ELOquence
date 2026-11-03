'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Dialog from '@/components/Dialog';
import { Button, Label } from '@/components/ui';
import type { Chapter } from '../_chapters';

/**
 * One chapter of the Help tour as a slide dialog — the same shape as the first-time
 * tutorial so the two feel like one thing. Arrow keys move between slides.
 */
export default function HelpTour({
  chapter,
  next,
  onClose,
  onNext,
}: {
  chapter: Chapter | null;
  /** The chapter after this one, if any — offered on the last slide. */
  next: Chapter | null;
  onClose: () => void;
  onNext: (c: Chapter) => void;
}) {
  const [step, setStep] = useState(0);
  const open = chapter !== null;

  // Start every chapter from its first slide.
  useEffect(() => setStep(0), [chapter?.slug]);

  const slides = chapter?.slides ?? [];
  const isLast = step >= slides.length - 1;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && !isLast) setStep((s) => s + 1);
      if (e.key === 'ArrowLeft' && step > 0) setStep((s) => s - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, isLast, step]);

  const current = slides[step];

  return (
    <Dialog open={open} onClose={onClose} label={chapter?.title ?? 'Help'} maxWidth="max-w-lg">
      {chapter && current && (
        <div className="p-6 md:p-8 flex flex-col gap-5">
          <div className="pr-8">
            <Label className="block">
              {chapter.number} · {chapter.title.toLowerCase()} · {step + 1}/{slides.length}
            </Label>
            <h2 className="font-display text-display-md text-text-primary mt-1 text-balance">{current.title}</h2>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={`${chapter.slug}-${step}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-4"
            >
              <div className="rule-hair pt-4 pb-1 min-h-[112px] flex items-center">{current.visual}</div>
              <p className="text-sm md:text-base leading-relaxed text-text-secondary">{current.body}</p>
              {current.aside && <p className="font-mono text-label uppercase text-text-tertiary">{current.aside}</p>}
              {isLast && (
                <Link href={chapter.cta.href} className="ink-link self-start font-mono text-label uppercase text-text-primary">
                  {chapter.cta.label} →
                </Link>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="rule-hair pt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setStep(i)}
                  className="block h-1.5 transition-all duration-med ease-ink"
                  style={{ width: i === step ? 20 : 6, backgroundColor: i === step ? 'var(--accent)' : 'var(--text-tertiary)' }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  <ArrowLeft size={13} />
                  Back
                </Button>
              )}
              {!isLast ? (
                <Button size="sm" onClick={() => setStep((s) => s + 1)} data-autofocus>
                  Next
                  <ArrowRight size={13} />
                </Button>
              ) : next ? (
                <Button size="sm" onClick={() => onNext(next)} data-autofocus>
                  Chapter {next.number}
                  <ArrowRight size={13} />
                </Button>
              ) : (
                <Button size="sm" onClick={onClose} data-autofocus>
                  Done
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
