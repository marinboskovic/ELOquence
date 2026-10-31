'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Skull, FlaskConical } from 'lucide-react';
import { springs } from '@/lib/animations';
import MiniWord from './MiniWord';

export interface NemesisWord {
  word: string;
  losses: number;
  last_lost_at: string | null;
  difficulty: number | null;
}

interface NemesisWordsProps {
  words: NemesisWord[] | undefined;
  loading?: boolean;
  delay?: number;
}

function Shimmer({ className }: { className?: string }) {
  return <div className={`skeleton rounded-md bg-bg-muted ${className ?? ''}`} />;
}

export default function NemesisWords({ words, loading = false, delay = 0 }: NemesisWordsProps) {
  const list = words ?? [];
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.slide, delay }}
      className="rounded-card-lg bg-bg-elevated border border-border-subtle p-5"
      aria-label="Nemesis words"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Skull size={14} className="text-text-ghost" />
          <span className="font-sans font-semibold text-sm text-text-primary">Nemesis Words</span>
        </div>
        {list.length > 0 && (
          <span className="font-sans text-[10px] font-mono tabular-nums text-text-secondary">
            {list.length} word{list.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Shimmer className="h-5 w-[108px]" />
              <Shimmer className="h-3 w-14" />
              <Shimmer className="h-3 w-10 ml-auto" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="font-sans text-sm text-text-secondary py-4 text-center">
          No nemesis yet — you&apos;ve solved everything you&apos;ve met.
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle" role="list">
          {list.map((n) => (
            <li key={n.word} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <MiniWord word={n.word} />
              <span className="font-sans text-xs text-text-secondary whitespace-nowrap">
                lost{' '}
                <span className="font-mono tabular-nums font-semibold" style={{ color: 'var(--red)' }}>
                  ×{n.losses}
                </span>
              </span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-text-secondary whitespace-nowrap hidden sm:inline">
                {n.difficulty != null ? `ELO ${n.difficulty}` : '—'}
              </span>
              <Link
                href={`/lab?word=${encodeURIComponent(n.word.toUpperCase())}`}
                className="inline-flex items-center gap-1 shrink-0 text-[11px] font-semibold text-text-secondary hover:text-text-primary transition-colors rounded px-1.5 py-1 hover:bg-bg-muted"
                aria-label={`Replay ${n.word.toUpperCase()} in the Opener Lab`}
              >
                <FlaskConical size={11} />
                <span className="hidden sm:inline">Replay in Lab</span>
                <span className="sm:hidden">Lab</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </motion.section>
  );
}
