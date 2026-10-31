'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { announcementsApi } from '@/lib/api';

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

  const iconColor = isWarning ? 'var(--red)' : 'var(--green)';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="overflow-hidden"
        >
          <div className="bg-bg-elevated border-b border-border-default px-4 py-2 flex items-center gap-3">
            {/* Icon */}
            {isWarning ? (
              <AlertTriangle
                size={13}
                className="flex-shrink-0"
                style={{ color: iconColor }}
                aria-hidden="true"
              />
            ) : (
              <Info
                size={13}
                className="flex-shrink-0"
                style={{ color: iconColor }}
                aria-hidden="true"
              />
            )}

            {/* Text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={index}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.18 }}
                className="flex-1 text-xs text-text-primary leading-relaxed"
              >
                {currentText}
              </motion.p>
            </AnimatePresence>

            {/* Nav arrows (multiple announcements) */}
            {showNav && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={handlePrev}
                  className="p-0.5 rounded text-text-secondary hover:text-text-primary transition-colors duration-150"
                  aria-label="Previous announcement"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] text-text-secondary tabular-nums">
                  {index + 1}/{announcements.length}
                </span>
                <button
                  onClick={handleNext}
                  className="p-0.5 rounded text-text-secondary hover:text-text-primary transition-colors duration-150"
                  aria-label="Next announcement"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-0.5 rounded text-text-secondary hover:text-text-primary transition-colors duration-150"
              aria-label="Dismiss announcement"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
