'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ButtonLink, Detail, Label, MiniTiles, Reveal, staggerChild, staggerParent } from '@/components/ui';
import { fmtInt } from '@/lib/copy';

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

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton bg-bg-muted ${className ?? ''}`} aria-hidden="true" />;
}

/**
 * "Words that beat you" — the words the player keeps losing to. Each row:
 * the word as absent-tone mini tiles, how many times it won, its difficulty
 * (Detailed view only) and a link to try it in the Word Lab.
 */
export default function NemesisWords({ words, loading = false, delay = 0 }: NemesisWordsProps) {
  const list = words ?? [];
  return (
    <Reveal as="section" delay={delay} aria-label="Words that beat you">
      <div className="rule-top pt-3 flex items-end justify-between gap-4">
        <div>
          <Label className="block mb-1">lost to</Label>
          <h2 className="font-display text-display-md text-text-primary">Words that beat you</h2>
        </div>
        {list.length > 0 && (
          <span className="font-mono text-xs tabular text-text-tertiary">
            {list.length} word{list.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading ? (
        <div className="mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rule-hair flex items-center gap-4 py-3">
              <Skeleton className="h-[22px] w-[122px]" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-4 bg-wash-green px-5 py-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="font-display text-display-sm text-text-primary">Nothing has beaten you yet.</p>
            <p className="text-sm text-text-secondary mt-1">Every word you have met, you solved. Words that get away will show up here.</p>
          </div>
          <ButtonLink href="/play" variant="secondary" size="sm" className="shrink-0">
            play a game
          </ButtonLink>
        </div>
      ) : (
        <>
          <p className="text-sm text-text-secondary mt-3 max-w-md">The words you lost to most. Try one in the Word Lab to see what would have cracked it.</p>
          <motion.ul className="mt-2" role="list" variants={staggerParent} initial="hidden" animate="show">
            {list.map((n) => (
              <motion.li
                key={n.word}
                variants={staggerChild}
                className="rule-hair flex items-center gap-4 py-3 hover:bg-bg-elevated transition-colors duration-fast -mx-2 px-2"
              >
                <MiniTiles word={n.word.toUpperCase().slice(0, 5)} size={22} />
                <span className="text-sm text-text-secondary whitespace-nowrap">
                  beat you <span className="font-mono tabular font-semibold text-text-primary">{n.losses}</span> time{n.losses !== 1 ? 's' : ''}
                </span>
                <Detail>
                  <span className="ml-auto font-mono text-xs tabular text-text-tertiary whitespace-nowrap hidden sm:inline">
                    {n.difficulty != null ? `difficulty ${fmtInt(n.difficulty)}` : '—'}
                  </span>
                </Detail>
                <Link
                  href={`/lab?word=${encodeURIComponent(n.word.toUpperCase())}`}
                  className="ink-link shrink-0 ml-auto font-mono text-label uppercase text-text-primary"
                  aria-label={`Try ${n.word.toUpperCase()} in the Word Lab`}
                >
                  try it →
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        </>
      )}
    </Reveal>
  );
}
