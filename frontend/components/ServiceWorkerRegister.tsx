'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js once on the client.
 *
 * Behavior:
 *  - Only runs in production OR when explicitly enabled via NEXT_PUBLIC_ENABLE_SW=1
 *    in dev (so HMR isn't disrupted by stale cached chunks during development).
 *  - The worker no longer calls skipWaiting() on install. When a new version
 *    has installed we post {type:'SKIP_WAITING'} to it; once it takes control
 *    (`controllerchange`) we reload exactly once so the page and its chunks
 *    come from the same build. No UI — the swap is silent.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const isProd = process.env.NODE_ENV === 'production';
    const forceEnable = process.env.NEXT_PUBLIC_ENABLE_SW === '1';
    if (!isProd && !forceEnable) return;

    let cancelled = false;
    let refreshing = false;

    const onControllerChange = () => {
      // Only reload when a *previous* controller existed (i.e. this is an
      // update, not the very first install), and never more than once.
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    const activate = (sw: ServiceWorker) => {
      sw.postMessage({ type: 'SKIP_WAITING' });
    };

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        if (cancelled) return;

        const hadController = Boolean(navigator.serviceWorker.controller);
        if (hadController) {
          navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
        }

        // A worker already waiting from a previous visit: apply it now.
        if (reg.waiting && hadController) {
          activate(reg.waiting);
        }

        // Future updates: wait for the new worker to finish installing, then
        // ask it to take over.
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              if (!hadController) {
                navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
              }
              activate(sw);
            }
          });
        });
      } catch (err) {
        console.warn('[sw] registration failed', err);
      }
    };

    // Defer to idle so we don't compete with critical-path work on first paint.
    const idle =
      (window as Window & typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
      }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1000));
    idle(register);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
