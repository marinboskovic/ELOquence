'use client';
import { useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';

/**
 * Bridges the app's "reduce motion" setting (the `.reduce-motion` class on
 * <html>, applied by the bootstrap script and `useSettings`) into
 * framer-motion. When the class is present every `motion.*` element gets
 * `reducedMotion="always"`; otherwise framer falls back to the OS preference.
 */
export default function MotionProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setReduced(root.classList.contains('reduce-motion'));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>{children}</MotionConfig>;
}
