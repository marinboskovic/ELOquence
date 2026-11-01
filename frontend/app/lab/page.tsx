'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import TileSpinner from '@/components/TileSpinner';
import { DetailToggle, Label, Reveal, SplitWords } from '@/components/ui';
import { fmtInt } from '@/lib/copy';
import clsx from 'clsx';
import OpenerAnalyser from './_components/OpenerAnalyser';
import PositionExplorer from './_components/PositionExplorer';

type LabTab = 'opener' | 'position';

const ANSWERS_TOTAL = 2309;

const TABS: { key: LabTab; label: string; blurb: string }[] = [
  { key: 'opener', label: 'First word', blurb: 'See how many answers a first word rules out, and which words do it best.' },
  { key: 'position', label: 'What next?', blurb: 'Rebuild a board you played and see the best next guess.' },
];

function LabInner() {
  const searchParams = useSearchParams();
  const initialWord = searchParams.get('word');
  const [tab, setTab] = useState<LabTab>(() =>
    searchParams.get('tab') === 'position' && !initialWord ? 'position' : 'opener'
  );
  const active = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
      {/* Title */}
      <header className="grid md:grid-cols-12 gap-6 md:gap-8 mb-10 md:mb-12">
        <div className="md:col-span-7">
          <Label className="block mb-3">Try a first word</Label>
          <SplitWords text="Word Lab" as="h1" className="font-display text-display-lg text-text-primary" />
        </div>
        <Reveal delay={0.2} className="md:col-span-5 md:pt-8">
          <p className="font-sans text-sm md:text-base text-text-secondary leading-relaxed">
            Type any five-letter word. We&apos;ll show how many of the {fmtInt(ANSWERS_TOTAL)} possible answers it rules
            out — and which words do it best.
          </p>
        </Reveal>
      </header>

      {/* Tabs: underline strip + Simple | Detailed switch */}
      <Reveal delay={0.1}>
        <div className="rule-top flex items-center justify-between gap-4 flex-wrap">
          <div role="tablist" aria-label="Lab sections" className="flex gap-6">
            {TABS.map((t) => {
              const on = tab === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={on}
                  aria-current={on ? 'true' : undefined}
                  onClick={() => setTab(t.key)}
                  className={clsx(
                    'relative py-3 font-mono text-label uppercase transition-colors duration-fast',
                    on ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary'
                  )}
                >
                  {t.label}
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'absolute left-0 right-0 -top-[2px] h-[2px] bg-accent origin-left transition-transform duration-med ease-ink',
                      on ? 'scale-x-100' : 'scale-x-0'
                    )}
                  />
                </button>
              );
            })}
          </div>
          <DetailToggle className="my-2" />
        </div>
        <p className="font-sans text-sm text-text-secondary mt-2 mb-10">{active.blurb}</p>
      </Reveal>

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
        <div className="flex items-center justify-center min-h-page">
          <TileSpinner size="md" label="Loading the Word Lab" />
        </div>
      }
    >
      <LabInner />
    </Suspense>
  );
}
