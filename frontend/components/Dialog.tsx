'use client';
import { ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { springs } from '@/lib/animations';

interface DialogProps {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  /** Accessible name (used when no `title`). */
  label?: string;
  /** Optional heading rendered inside the card and wired to aria-labelledby. */
  title?: ReactNode;
  /** Tailwind max-width class, defaults to max-w-sm. */
  maxWidth?: string;
  hideClose?: boolean;
  /** Prevent closing via backdrop / Escape (e.g. while a request is in flight). */
  locked?: boolean;
  /** Thin accent stripe at the top of the card (danger confirms use --red). */
  accent?: string;
  className?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one accessible dialog primitive for the app.
 *
 * - `role="dialog"` + `aria-modal`, labelled by `title` or `label`
 * - focus moves into the card on open and is **trapped** (Tab cycles)
 * - Escape and backdrop click close it (unless `locked`)
 * - focus returns to the element that opened it
 * - body scroll is locked while open
 * - theme-aware: light backdrop in light mode, dark in dark mode
 */
export default function Dialog({
  open,
  onClose,
  children,
  label = 'Dialog',
  title,
  maxWidth = 'max-w-sm',
  hideClose = false,
  locked = false,
  accent,
  className,
}: DialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  const requestClose = useCallback(() => {
    if (!locked) onClose?.();
  }, [locked, onClose]);

  // Focus management + Escape + Tab trap
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = (document.activeElement as HTMLElement) ?? null;

    const focusFirst = () => {
      const card = cardRef.current;
      if (!card) return;
      const autofocus = card.querySelector<HTMLElement>('[data-autofocus]');
      const first = autofocus ?? card.querySelector<HTMLElement>(FOCUSABLE) ?? card;
      first.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        requestClose();
        return;
      }
      if (e.key !== 'Tab' || !cardRef.current) return;
      const nodes = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null
      );
      if (nodes.length === 0) {
        e.preventDefault();
        cardRef.current.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !cardRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture phase so page-level listeners (the game keyboard) never see
    // keystrokes meant for the dialog.
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      returnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open, requestClose]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[60] backdrop-blur-sm"
            style={{ background: 'var(--dialog-backdrop, rgba(0,0,0,0.5))' }}
            onClick={requestClose}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              ref={cardRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-label={title ? undefined : label}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={springs.modal}
              className={clsx(
                'relative w-full bg-bg-base rounded-2xl border border-border-subtle shadow-modal overflow-hidden pointer-events-auto outline-none',
                maxWidth,
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {accent && <div className="h-1 w-full" style={{ background: accent }} aria-hidden="true" />}
              {!hideClose && onClose && (
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={locked}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors disabled:opacity-40"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              )}
              {title && (
                <h2 id={titleId} className="font-display font-black text-lg tracking-tight text-text-primary px-5 pt-5">
                  {title}
                </h2>
              )}
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
