'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share, X, Plus } from 'lucide-react';
import { Button, Label } from '@/components/ui';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  subscribeInstall,
  getDeferredPrompt,
  consumeDeferredPrompt,
} from '@/lib/pwaInstall';

// Per-account, per-device flag. Once set the install card never shows again
// on this browser for this user. Different accounts on the same browser get
// independent flags.
const seenKey = (userId: string) => `eloquence_install_seen_${userId}`;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function alreadySeen(userId: string): boolean {
  try {
    return localStorage.getItem(seenKey(userId)) !== null;
  } catch {
    return false;
  }
}

function markSeen(userId: string) {
  try {
    localStorage.setItem(seenKey(userId), String(Date.now()));
  } catch {
    // private mode / quota — best effort
  }
}

// Inline install card. Rendered inside the dashboard (not the global layout),
// so the prompt lives on the dashboard rather than floating over every page.
// The browser install event itself is captured app-wide by InstallCapture and
// read here via the shared store.
export default function InstallPrompt() {
  const { user } = useAuth();
  const deferred = useSyncExternalStore(
    subscribeInstall,
    getDeferredPrompt,
    () => null,
  );

  // Defer all window/localStorage reads to after mount so SSR and the first
  // client render agree (both render nothing).
  const [mounted, setMounted] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => setMounted(true), []);

  // iOS Safari never fires beforeinstallprompt — surface a manual "Add to
  // Home Screen" hint shortly after the dashboard loads instead.
  useEffect(() => {
    if (!mounted || !user) return;
    if (isStandalone() || alreadySeen(user.id) || !isIosSafari()) return;
    const t = window.setTimeout(() => setShowIosHint(true), 1500);
    return () => window.clearTimeout(t);
  }, [mounted, user]);

  if (!mounted || !user) return null;

  const eligible =
    !dismissed && !isStandalone() && !alreadySeen(user.id);
  const visible = eligible && (!!deferred || showIosHint);

  const dismiss = () => {
    markSeen(user.id);
    setDismissed(true);
    consumeDeferredPrompt();
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch (err) {
      console.warn('[install] prompt failed', err);
    } finally {
      markSeen(user.id);
      consumeDeferredPrompt();
      setDismissed(true);
    }
  };

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
          className="overflow-hidden"
          role="dialog"
          aria-label="Install ELOquence"
        >
          {/* Ochre wash band: the one wash on the dashboard viewport. */}
          <div className="bg-wash-ochre px-5 py-5 md:px-6 flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
            <div className="min-w-0">
              <Label className="block mb-1">{showIosHint ? 'home screen' : 'install'}</Label>
              <p className="font-display text-display-sm text-text-primary">
                {showIosHint ? 'Add ELOquence to your home screen.' : 'Install ELOquence.'}
              </p>
              {showIosHint ? (
                <p className="text-sm text-text-secondary mt-1 flex items-center gap-1 flex-wrap">
                  Tap <Share size={13} aria-label="Share" className="inline-block" /> then
                  <span className="inline-flex items-center gap-0.5 font-mono text-xs">
                    <Plus size={12} aria-hidden="true" /> Add to Home Screen
                  </span>
                </p>
              ) : (
                <p className="text-sm text-text-secondary mt-1">
                  Faster launch, full-screen play, works offline.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {!showIosHint && (
                <>
                  <Button size="sm" onClick={install}>
                    Install
                  </Button>
                  <Button size="sm" variant="ghost" onClick={dismiss}>
                    Not now
                  </Button>
                </>
              )}
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors duration-fast"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
