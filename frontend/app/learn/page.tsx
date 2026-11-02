'use client';

/**
 * Learn page — Duolingo-style gamified mini-challenges.
 *
 * Two views:
 *   1. Module overview (default) — an editorial index: numbered modules,
 *      lessons as hair-ruled rows, locked-state for lessons past the next-up.
 *   2. Active lesson — full LessonRunner takes over with a sequence of
 *      mini-challenges. Closing the runner returns to the overview.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock } from 'lucide-react';
import { Button, ButtonLink, Label, SplitWords, Reveal } from '@/components/ui';
import { useAuth } from '@/lib/hooks/useAuth';
import clsx from 'clsx';
import LessonRunner from './_components/challenges/LessonRunner';
import ScrollArea from '@/components/ScrollArea';
import { MODULES, TOTAL_LESSONS, findLesson, LESSON_ORDER } from './_lessons';
import { learnApi } from '@/lib/api';
import { hasSession, LEARN_PROGRESS_KEY as STORAGE_KEY } from '@/lib/session';
/* Guests can try this many lessons (Module 1); the rest need a free account. */
const GUEST_FREE_LESSONS = 3;

/* Progress map: lessonId → number of challenges completed (high-water mark
 * across all sessions). A lesson is "done" when this value ≥ challenges.length. */
type Progress = Record<string, number>;

function loadProgress(): Progress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: Record<string, unknown> = JSON.parse(raw);
    const result: Progress = {};
    // Migrate old boolean format → use a sentinel large number for "true"
    // so it compares ≥ any lesson.challenges.length and reads as fully done.
    for (const [key, val] of Object.entries(parsed)) {
      if (typeof val === 'boolean') result[key] = val ? 999 : 0;
      else if (typeof val === 'number') result[key] = val;
    }
    return result;
  } catch {
    return {};
  }
}

function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota */
  }
}

/* Signed-in users get their progress synced to the backend so it follows the
 * account across devices; guests keep using localStorage only. We gate purely
 * on a stored token so a guest visit never triggers the 401→/login redirect
 * baked into the axios interceptor. */
function isSignedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return hasSession();
}

/* Per-lesson high-water-mark merge: take the larger count from each side. */
function mergeProgress(a: Progress, b: Progress): Progress {
  const out: Progress = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = Math.max(out[k] || 0, v);
  }
  return out;
}

/* True when `local` holds progress the server hasn't seen yet (something to
 * push up — e.g. lessons completed on this device before sync existed). */
function localExceedsRemote(local: Progress, remote: Progress): boolean {
  for (const [k, v] of Object.entries(local)) {
    if (v > (remote[k] || 0)) return true;
  }
  return false;
}

export default function LearnPage() {
  const [progress, setProgress] = useState<Progress>({});
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const { user } = useAuth();
  const guest = !user;
  const guestLocked = useCallback((lessonId: string) => guest && LESSON_ORDER.indexOf(lessonId) >= GUEST_FREE_LESSONS, [guest]);

  useEffect(() => {
    // 1. Show the local cache immediately so there's no flash of empty state.
    const local = loadProgress();
    setProgress(local);

    // 2. If signed in, reconcile with the server: pull remote progress, merge
    //    it with local as a high-water mark, adopt the result, and push up any
    //    progress the server is missing (one-time migration of localStorage
    //    that predates sync). Failures are swallowed — we keep the local cache.
    if (!isSignedIn()) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await learnApi.getProgress();
        if (cancelled) return;
        const remote: Progress = data?.progress ?? {};
        const merged = mergeProgress(local, remote);
        setProgress(merged);
        saveProgress(merged);
        if (localExceedsRemote(local, remote)) {
          await learnApi.saveProgress(merged);
        }
      } catch {
        /* offline / token expired — keep using the local cache */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // A guest can't have finished a locked lesson — anything there is a leftover
  // account cache (e.g. the session expired without a sign-out), so hide it.
  const shown = useMemo<Progress>(
    () => (guest ? Object.fromEntries(Object.entries(progress).filter(([id]) => !guestLocked(id))) : progress),
    [progress, guest, guestLocked],
  );

  // Lesson is fully complete when the stored count ≥ its challenges length.
  const lessonDone = useCallback(
    (lessonId: string): boolean => {
      const lesson = findLesson(lessonId)?.lesson;
      if (!lesson) return false;
      return (shown[lessonId] || 0) >= lesson.challenges.length;
    },
    [shown],
  );

  const completedCount = LESSON_ORDER.filter((id) => lessonDone(id)).length;

  const handleStart = useCallback((lessonId: string) => {
    setActiveLessonId(lessonId);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleProgress = useCallback(
    (count: number) => {
      if (!activeLessonId) return;
      setProgress((prev) => {
        const current = prev[activeLessonId] || 0;
        if (count <= current) return prev;
        const next = { ...prev, [activeLessonId]: count };
        saveProgress(next);
        // Fire-and-forget sync of just this lesson's new high-water mark; the
        // server merges it (GREATEST), so a dropped request just retries on the
        // next save and the local cache stays authoritative meanwhile.
        if (isSignedIn()) {
          learnApi.saveProgress({ [activeLessonId]: count }).catch(() => {});
        }
        return next;
      });
    },
    [activeLessonId],
  );

  const handleComplete = useCallback(() => {
    if (!activeLessonId) return;
    // Auto-advance to the next lesson; if none, return to overview.
    const currentIdx = LESSON_ORDER.indexOf(activeLessonId);
    const nextId = LESSON_ORDER[currentIdx + 1];
    if (nextId && !guestLocked(nextId)) {
      setActiveLessonId(nextId);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setActiveLessonId(null);
    }
  }, [activeLessonId, guestLocked]);

  const activeLesson = activeLessonId ? findLesson(activeLessonId) : null;

  // First lesson in LESSON_ORDER that isn't fully done. Everything past it is
  // locked. If everything is done, this is null.
  const firstIncompleteId = LESSON_ORDER.find((id) => !lessonDone(id)) ?? null;
  const firstIncompleteIdx = firstIncompleteId
    ? LESSON_ORDER.indexOf(firstIncompleteId)
    : LESSON_ORDER.length;

  // A lesson is unlocked if it's the first incomplete OR something before it
  // in the global order. (Done lessons are always replayable.)
  const isLessonUnlocked = useCallback(
    (lessonId: string): boolean => {
      const idx = LESSON_ORDER.indexOf(lessonId);
      if (idx === -1) return false;
      if (guestLocked(lessonId)) return false;
      return idx <= firstIncompleteIdx;
    },
    [firstIncompleteIdx, guestLocked],
  );

  // Active lesson view — the scroll container is the inner bounded column,
  // not the outer page, so the scrollbar sits at the right edge of the
  // content rather than at the far right of the viewport.
  if (activeLesson) {
    return (
      <div className="h-page bg-bg-base flex justify-center">
        <ScrollArea
          style={{
            width: '100%',
            maxWidth: 720,
            height: '100%',
            scrollbarGutter: 'stable',
            padding: '24px 16px 48px',
          }}
        >
          <LessonRunner
            lesson={activeLesson.lesson}
            onComplete={handleComplete}
            onProgress={handleProgress}
          />
        </ScrollArea>
      </div>
    );
  }

  // Overview view — same trick: scroll happens on the bounded inner column.
  const overallPct = TOTAL_LESSONS > 0 ? completedCount / TOTAL_LESSONS : 0;
  const hasAnyProgress = Object.values(progress).some((n) => n > 0);
  const firstLesson = MODULES[0]?.lessons[0] ?? null;

  return (
    <div className="h-page bg-bg-base flex justify-center">
      <ScrollArea
        style={{
          width: '100%',
          maxWidth: 1152,
          height: '100%',
          scrollbarGutter: 'stable',
        }}
      >
        <div className="px-4 md:px-8 py-10 md:py-16">
          {/* Header */}
          <header className="grid md:grid-cols-12 gap-6 md:gap-8 mb-12 md:mb-16">
            <div className="md:col-span-7">
              <Label className="block mb-3">learn · {MODULES.length} modules · {TOTAL_LESSONS} lessons</Label>
              <SplitWords text="Learn" as="h1" className="font-display text-display-lg text-text-primary" />
              <Reveal delay={0.15}>
                <p className="font-display text-display-sm text-text-primary mt-4 max-w-md text-balance">
                  Ten minutes of lessons. Then your guesses start getting better.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.2} className="md:col-span-5 md:self-end">
              {!hasAnyProgress && firstLesson ? (
                /* Nothing done yet: point at lesson 1 instead of an empty progress bar. */
                <div className="rule-top pt-3 flex flex-col gap-3">
                  <Label>start here</Label>
                  <p className="font-sans text-sm text-text-secondary leading-relaxed">
                    Module 1 · {MODULES[0].title} — {firstLesson.title}. A few minutes, no account needed for the first {GUEST_FREE_LESSONS}.
                  </p>
                  <Button size="md" onClick={() => handleStart(firstLesson.id)} className="self-start">
                    Start lesson 1
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-4 mb-2">
                    <Label>progress</Label>
                    <span className="font-mono text-xs tabular text-text-secondary">
                      {completedCount} of {TOTAL_LESSONS} lessons done
                    </span>
                  </div>
                  {/* Overall progress: a thin ink rule that grows */}
                  <div className="relative h-[2px] w-full">
                    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border-subtle" aria-hidden="true" />
                    <motion.div
                      className="absolute inset-y-0 left-0 w-full origin-left bg-bg-ink"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: overallPct }}
                      transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1], delay: 0.3 }}
                      role="progressbar"
                      aria-label="Lessons completed"
                      aria-valuemin={0}
                      aria-valuemax={TOTAL_LESSONS}
                      aria-valuenow={completedCount}
                    />
                  </div>
                </>
              )}
            </Reveal>
          </header>

          {guest && (
            /* Guests: the first module is a free taste; the rest needs an account so progress can be kept. */
            <Reveal className="bg-wash-green px-5 md:px-8 py-5 mb-12 md:mb-16 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <Label className="block mb-1">free to try</Label>
                <p className="font-sans text-sm text-text-primary max-w-xl">
                  The first {GUEST_FREE_LESSONS} lessons are open to everyone. A free account unlocks all {TOTAL_LESSONS} and keeps your progress on every device.
                </p>
              </div>
              <ButtonLink href="/register?next=/learn" size="md" className="shrink-0 self-start md:self-auto">
                Create a free account
              </ButtonLink>
            </Reveal>
          )}

          {/* Modules: an editorial index */}
          <div className="flex flex-col gap-12 md:gap-16">
            {MODULES.map((mod, mi) => {
              // Aggregate challenge counts across the module: how many done, how many total.
              const modChallengesDone = mod.lessons.reduce(
                (sum, l) => sum + Math.min(shown[l.id] || 0, l.challenges.length),
                0,
              );
              const modChallengesTotal = mod.lessons.reduce((sum, l) => sum + l.challenges.length, 0);
              const lessonsFullyDone = mod.lessons.filter(
                (l) => (shown[l.id] || 0) >= l.challenges.length,
              ).length;
              const totalInMod = mod.lessons.length;
              const modDone = modChallengesTotal > 0 && modChallengesDone >= modChallengesTotal;

              // A module is locked when its *first* lesson is past the first
              // incomplete one — i.e. the previous module isn't fully done.
              const moduleLocked = !isLessonUnlocked(mod.lessons[0].id);

              return (
                <Reveal key={mod.id} as="section" delay={Math.min(mi * 0.04, 0.2)} className={clsx(moduleLocked && 'opacity-50')}>
                  <div className="rule-top pt-4 grid md:grid-cols-12 gap-4 md:gap-8">
                    {/* Module number + title */}
                    <div className="md:col-span-5 flex gap-4 md:gap-6 items-start">
                      <span className="font-display text-display-md tabular text-text-primary leading-none shrink-0" aria-hidden="true">
                        {String(mi + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 pt-1">
                        <Label className="block mb-1">module {mi + 1}</Label>
                        <h2 className="font-display text-display-sm text-text-primary">{mod.title}</h2>
                        <p className="font-sans text-sm text-text-secondary mt-1 leading-relaxed">{mod.blurb}</p>
                        <span className="inline-block mt-3 font-mono text-xs tabular text-text-tertiary">
                          {lessonsFullyDone}/{totalInMod} lessons
                          {modDone ? ' · complete' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Lessons as hair-ruled rows */}
                    <ul className="md:col-span-7 flex flex-col list-none m-0 p-0">
                      {mod.lessons.map((l, li) => {
                        const challengesDone = Math.min(shown[l.id] || 0, l.challenges.length);
                        const total = l.challenges.length;
                        const done = challengesDone >= total;
                        const inProgress = challengesDone > 0 && !done;
                        const locked = !isLessonUnlocked(l.id);
                        const isNext = !locked && !done && l.id === firstIncompleteId;

                        return (
                          <li key={l.id} className="border-b border-border-subtle first:border-t first:border-border-subtle md:first:border-t-0">
                            <button
                              type="button"
                              onClick={() => !locked && handleStart(l.id)}
                              disabled={locked}
                              aria-label={`${locked ? 'Locked: ' : ''}Lesson ${li + 1}, ${l.title}, ${challengesDone} of ${total} steps done`}
                              className={clsx(
                                'group w-full flex items-center gap-4 py-3 text-left transition-colors duration-fast',
                                locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-bg-elevated'
                              )}
                            >
                              {/* Progress square: filled ink when done, half when in progress */}
                              <span
                                className={clsx(
                                  'relative w-4 h-4 shrink-0 border-2 overflow-hidden',
                                  done ? 'bg-bg-ink border-border-default' : locked ? 'border-border-subtle' : 'border-border-default'
                                )}
                                aria-hidden="true"
                              >
                                {inProgress && (
                                  <span
                                    className="absolute left-0 bottom-0 w-full bg-bg-ink"
                                    style={{ height: `${Math.round((challengesDone / total) * 100)}%` }}
                                  />
                                )}
                                {done && <Check size={10} strokeWidth={3} className="absolute inset-0 m-auto text-text-on-ink" />}
                              </span>

                              <span className="font-mono text-xs tabular text-text-tertiary w-6 shrink-0">{String(li + 1).padStart(2, '0')}</span>

                              <span className="flex-1 min-w-0">
                                <span className={clsx('block font-sans font-semibold text-sm', locked ? 'text-text-secondary' : 'text-text-primary')}>
                                  <span className={clsx(!locked && 'ink-link')}>{l.title}</span>
                                </span>
                                {l.subtitle && <span className="block font-sans text-xs text-text-tertiary mt-0.5">{l.subtitle}</span>}
                              </span>

                              <span className="flex items-center gap-3 shrink-0">
                                {isNext && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true" />}
                                {locked && guestLocked(l.id) ? (
                                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-text-tertiary">free account</span>
                                ) : locked ? (
                                  <Lock size={12} className="text-text-tertiary" aria-hidden="true" />
                                ) : (
                                  <span className="font-mono text-xs tabular text-text-tertiary">
                                    {challengesDone}/{total}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
