'use client';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface Props {
  active: boolean;
  count?: number;
  duration?: number;
  colors?: string[];
}

/**
 * Atelier confetti: square paper chips in the three tile colours plus the
 * single accent. Colours are CSS variables so dark mode and the colour-blind
 * palette apply automatically.
 */
const DEFAULT_COLORS = [
  'var(--tile-correct)',
  'var(--tile-present)',
  'var(--tile-absent)',
  'var(--accent)',
];

interface Particle {
  id: number;
  x: number;
  color: string;
  delay: number;
  rotation: number;
  rotationEnd: number;
  size: number;
  fallDuration: number;
  drift: number;
  fallDistance: number;
}

function buildParticles(count: number, colors: string[]): Particle[] {
  const fallDistance = typeof window !== 'undefined' ? window.innerHeight + 60 : 900;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    delay: Math.random() * 0.65,
    rotation: Math.random() * 360,
    rotationEnd: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
    size: 6 + Math.random() * 6,
    fallDuration: 1.6 + Math.random() * 1.2,
    drift: (Math.random() - 0.5) * 60,
    fallDistance,
  }));
}

export default function Confetti({ active, count = 48, duration = 2800, colors }: Props) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reducedMotion) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setParticles([]);
      return;
    }
    setParticles(buildParticles(count, colors ?? DEFAULT_COLORS));
    timerRef.current = setTimeout(() => setParticles([]), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, count, duration, colors, reducedMotion]);

  return (
    <AnimatePresence>
      {particles.length > 0 && (
        <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden" aria-hidden="true">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ x: `${p.x}vw`, y: 0, opacity: 1, rotate: p.rotation }}
              animate={{
                y: p.fallDistance,
                x: [`${p.x}vw`, `calc(${p.x}vw + ${p.drift}px)`],
                opacity: [1, 1, 0.8, 0],
                rotate: p.rotationEnd,
              }}
              transition={{
                duration: p.fallDuration,
                delay: p.delay,
                ease: [0.2, 0, 0.8, 1],
                opacity: { times: [0, 0.5, 0.8, 1] },
              }}
              style={{
                position: 'absolute',
                top: -12,
                left: 0,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
              }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
