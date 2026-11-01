'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { announcementsApi } from '@/lib/api';
import { Label } from '@/components/ui';

interface ActiveAnnouncement {
  id: string;
  text: string;
  type?: 'info' | 'warning' | 'error';
}

// Dismissed announcement ids for this browser session (JSON string[]), so a
// new announcement still shows after an older one was dismissed.
const SESSION_KEY = 'eloquence_announcements_dismissed_ids';

function readDismissedIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — dismissal just won't persist */
  }
}

const SQUARE_BTN =
  'w-7 h-7 flex items-center justify-center text-text-secondary hover:bg-bg-ink hover:text-text-on-ink transition-colors duration-fast';

/**
 * A thin ochre strip under the nav: mono "notice" label, the message, a
 * square close button. Warning/error announcements swap to the accent wash.
 */
export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<ActiveAnnouncement[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    announcementsApi
      .active()
      .then((res) => {
        const data: ActiveAnnouncement[] = res.data;
        const dismissedIds = new Set(readDismissedIds());
        const fresh = (data ?? []).filter((a) => !dismissedIds.has(String(a.id)));
        if (fresh.length > 0) {
          setAnnouncements(fresh);
          setIndex(0);
          setVisible(true);
        }
      })
      .catch(() => {
        // Silent fail — banner is non-critical
      });
  }, []);

  // Dismiss only the announcement currently shown; the others stay in rotation.
  const handleDismiss = useCallback(() => {
    const current = announcements[index];
    if (!current) return;
    const ids = readDismissedIds();
    if (!ids.includes(String(current.id))) writeDismissedIds([...ids, String(current.id)]);

    const remaining = announcements.filter((a) => a.id !== current.id);
    if (remaining.length === 0) {
      setVisible(false);
      // Remove from state after exit animation
      setTimeout(() => setAnnouncements([]), 300);
      return;
    }
    setAnnouncements(remaining);
    setIndex((i) => Math.min(i, remaining.length - 1));
  }, [announcements, index]);

  const handlePrev = () => {
    setIndex((i) => (i - 1 + announcements.length) % announcements.length);
  };

  const handleNext = () => {
    setIndex((i) => (i + 1) % announcements.length);
  };

  if (announcements.length === 0) return null;

  const current = announcements[index];
  const currentText = current?.text ?? '';
  const isWarning = current?.type === 'warning' || current?.type === 'error';
  const showNav = announcements.length > 1;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className={`${isWarning ? 'bg-wash-accent' : 'bg-wash-ochre'} border-b border-border-subtle`}>
            <div className="max-w-6xl mx-auto px-4 md:px-8 h-9 flex items-center gap-4">
              <Label className="text-text-primary shrink-0">{isWarning ? 'warning' : 'notice'}</Label>

              <AnimatePresence mode="wait">
                <motion.p
                  key={index}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 min-w-0 truncate text-sm text-text-primary"
                >
                  {currentText}
                </motion.p>
              </AnimatePresence>

              {showNav && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={handlePrev} className={SQUARE_BTN} aria-label="Previous announcement">
                    <ChevronLeft size={14} />
                  </button>
                  <span className="font-mono text-[11px] text-text-secondary tabular">
                    {index + 1}/{announcements.length}
                  </span>
                  <button onClick={handleNext} className={SQUARE_BTN} aria-label="Next announcement">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              <button onClick={handleDismiss} className={`${SQUARE_BTN} shrink-0`} aria-label="Dismiss announcement">
                <X size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
