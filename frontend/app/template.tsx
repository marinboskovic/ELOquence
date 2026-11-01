'use client';
import { motion } from 'framer-motion';

/**
 * Page-enter transition: every route's content rises 12px and fades in
 * (DESIGN.md §5). `template.tsx` remounts per navigation, which is exactly
 * what we want for an enter animation without an exit choreography.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
