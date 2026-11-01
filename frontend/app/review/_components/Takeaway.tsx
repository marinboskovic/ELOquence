'use client';
/**
 * The one ink block on the review page: a single sentence that says the most
 * useful thing about this game.
 */
import { Reveal } from '@/components/ui';

export default function Takeaway({ text }: { text: string }) {
  return (
    <Reveal as="section" aria-labelledby="takeaway-heading" className="bg-bg-ink text-text-on-ink px-6 py-8 md:px-10 md:py-10">
      <h2 id="takeaway-heading" className="font-mono text-label uppercase tracking-[0.14em] opacity-70 mb-3">
        One thing to take away
      </h2>
      <p className="font-display text-display-md [text-wrap:balance]">{text}</p>
    </Reveal>
  );
}
