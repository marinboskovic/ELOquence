'use client';
import { AnimatePresence, motion } from 'framer-motion';

interface ToastProps {
  message: string;
  visible: boolean;
}

/** Ink block that drops in under the nav. */
export default function Toast({ message, visible }: ToastProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[60]"
          style={{ top: 'calc(var(--nav-h) + 16px)' }}
          role="alert"
          aria-live="assertive"
        >
          <div className="px-4 py-2.5 bg-bg-ink text-text-on-ink font-display font-bold text-sm tracking-[-0.01em] whitespace-nowrap select-none shadow-ink border-2 border-border-default">
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
