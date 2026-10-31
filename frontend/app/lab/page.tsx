'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FlaskConical } from 'lucide-react';
import TileSpinner from '@/components/TileSpinner';
import { springs } from '@/lib/animations';
import clsx from 'clsx';
import OpenerAnalyser from './_components/OpenerAnalyser';
import PositionExplorer from './_components/PositionExplorer';

type LabTab = 'opener' | 'position';

const TABS: { key: LabTab; label: string; blurb: string }[] = [
  { key: 'opener', label: 'Opener analyser', blurb: 'How much does your first word actually tell you?' },
  { key: 'position', label: 'What next?', blurb: 'Paint the board you have and ask the engine.' },
];

function LabInner() {
  const searchParams = useSearchParams();
  const initialWord = searchParams.get('word');
  const [tab, setTab] = useState<LabTab>(() =>
    searchParams.get('tab') === 'position' && !initialWord ? 'position' : 'opener'
  );
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={springs.slide} className="flex items-center gap-3 mb-1">
        <FlaskConical size={22} className="text-text-ghost shrink-0" aria-hidden="true" />
        <h1 className="font-display font-black tracking-tight text-4xl text-text-primary">Opener Lab</h1>
      </motion.div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...springs.slide, delay: 0.08 }}
        className="font-sans text-sm text-text-secondary mb-5 max-w-2xl leading-relaxed"
      >
        Information theory, interactive. Every guess splits the 2,309 possible answers into feedback buckets — the
        more evenly, the more bits you earn. This is the same engine that grades your games, opened up so you can poke
        at it: test any opener, or rebuild a board you played and ask what the best next guess was.
      </motion.p>

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ ...springs.slide, delay: 0.09 }}
        role="tablist"
        aria-label="Lab sections"
        className="flex gap-1 mb-2 border-b border-border-subtle"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={clsx(
              'px-4 py-2 font-sans text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 rounded-t',
              tab === t.key ? 'border-tile-correct text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'
            )}
            style={{ outlineColor: 'var(--tile-correct)' }}
          >
            {t.label}
          </button>
        ))}
      </motion.div>
      <p className="font-sans text-xs text-text-ghost mb-6">{active.blurb}</p>

      <div role="tabpanel" key={tab}>
        {tab === 'opener' ? <OpenerAnalyser initialWord={initialWord} /> : <PositionExplorer />}
      </div>
    </div>
  );
}

export default function LabPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100dvh-52px)]">
          <TileSpinner size="md" label="Loading lab" />
        </div>
      }
    >
      <LabInner />
    </Suspense>
  );
}
