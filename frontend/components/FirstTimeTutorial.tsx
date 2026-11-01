'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import Dialog from '@/components/Dialog';
import Tile from '@/components/Tile';
import { Button, Label } from '@/components/ui';
import type { TileState } from '@/lib/types';

// One-time "how to play Wordle" intro for people who've never seen the game.
// Shown once per device the first time someone lands on the play screen, then
// silenced via localStorage. Built on the shared Dialog primitive.
const SEEN_KEY = 'eloquence_tutorial_seen';

const T = '40px';

function Row({ word, states, size = T }: { word: string; states: TileState[]; size?: string }) {
  return (
    <div className="flex" style={{ gap: 5 }}>
      {word.split('').map((c, i) => (
        <Tile key={i} letter={c} state={states[i]} position={i} size={size} />
      ))}
    </div>
  );
}

interface Step {
  title: string;
  body: string;
  visual: React.ReactNode;
}

const STEPS: Step[] = [
  {
    title: 'Guess the word',
    body: 'ELOquence is Wordle. Find the hidden 5-letter word in 6 tries. Type any real word to make a guess.',
    visual: <Row word="GUESS" states={['tbd', 'tbd', 'tbd', 'tbd', 'tbd']} />,
  },
  {
    title: 'Read the colours',
    body: 'After each guess the tiles change colour to tell you how close you are.',
    visual: (
      <div className="flex flex-col gap-3 w-full">
        {([
          ['R', 'correct', 'Right letter, right spot.'],
          ['O', 'present', 'In the word — but wrong spot.'],
          ['T', 'absent', 'Not in the word at all.'],
        ] as [string, TileState, string][]).map(([ch, state, label]) => (
          <div key={ch} className="flex items-center gap-3">
            <Tile letter={ch} state={state} size={T} />
            <span className="text-sm text-text-secondary">{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Narrow it down',
    body: 'Use the clues to rule words out, then land the answer before your six guesses run out. That’s the whole game.',
    visual: (
      <div className="flex flex-col" style={{ gap: 5 }}>
        <Row word="SLATE" states={['absent', 'absent', 'present', 'absent', 'correct']} size="36px" />
        <Row word="ABIDE" states={['present', 'absent', 'correct', 'absent', 'correct']} size="36px" />
      </div>
    ),
  },
];

export default function FirstTimeTutorial({ openSignal }: { openSignal?: number }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY) == null) setOpen(true);
    } catch {
      // private mode / quota — just don't show
    }
  }, []);

  // Manual re-open from the play screen's "?" help button. openSignal starts
  // at 0 (no-op on mount) and increments on each click, re-opening at step 1.
  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setStep(0);
      setOpen(true);
    }
  }, [openSignal]);

  const close = useCallback(() => {
    try {
      localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {
      // best effort
    }
    setOpen(false);
  }, []);

  const isLast = step >= STEPS.length - 1;
  const next = () => (isLast ? close() : setStep((s) => s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const current = STEPS[step];

  return (
    <Dialog open={open} onClose={close} label="How to play" maxWidth="max-w-md">
      <div className="p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="pr-8">
          <Label className="block">
            new to wordle? · {step + 1}/{STEPS.length}
          </Label>
          <h2 className="font-display text-display-md text-text-primary mt-1">{current.title}</h2>
        </div>

        {/* Visual + body (keyed so it animates between steps) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4"
          >
            <div className="rule-hair pt-4 pb-1 min-h-[96px] flex items-center">{current.visual}</div>
            <p className="text-sm leading-relaxed text-text-secondary">{current.body}</p>
          </motion.div>
        </AnimatePresence>

        {/* Footer: progress squares + nav */}
        <div className="rule-hair pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className="block h-1.5 transition-all duration-med ease-ink"
                style={{
                  width: i === step ? 20 : 6,
                  backgroundColor: i === step ? 'var(--accent)' : 'var(--text-ghost)',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={back}>
                <ArrowLeft size={13} />
                Back
              </Button>
            )}
            <Button size="sm" onClick={next} data-autofocus>
              {isLast ? 'Got it — play' : 'Next'}
              {!isLast && <ArrowRight size={13} />}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
