'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dailyApi } from '@/lib/api';
import { useAuth } from '@/lib/hooks/useAuth';
import { Button, Hint, Label, Reveal, SplitWords, Stat, Tag } from '@/components/ui';
import clsx from 'clsx';

interface ArchiveEntry {
  date: string;
  puzzle_number: number | null;
  played: boolean;
  status: 'won' | 'lost' | 'in_progress' | null;
  guesses: number | null;
  /** True only when the daily was solved on its actual date.
   *  False means it was completed later via archive replay. */
  played_on_day?: boolean;
}

const WEEKDAYS = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];

function todayStr(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

function isFutureDate(dateStr: string): boolean {
  return dateStr > todayStr();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Tiny pattern-grid summarising a played day: one row per guess, the last
 * row all-correct for a win. Deliberately abstract (we don't have the real
 * per-guess patterns here) — it reads as "solved in N" at a glance.
 */
function DayGrid({ entry, replay }: { entry: ArchiveEntry; replay: boolean }) {
  const n = entry.guesses ?? 0;
  const rows = Math.max(1, Math.min(6, n || (entry.status === 'lost' ? 6 : 1)));
  const won = entry.status === 'won';
  const inProgress = entry.status === 'in_progress';
  return (
    <span className="flex flex-col items-start" style={{ gap: 1.5 }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => {
        const last = r === rows - 1;
        const fill = won && last ? 'var(--tile-correct)' : inProgress && last ? 'var(--tile-present)' : 'var(--tile-absent)';
        return (
          <span key={r} className="flex" style={{ gap: 1.5 }}>
            {Array.from({ length: 5 }).map((__, c) => (
              <span
                key={c}
                style={{
                  width: 4,
                  height: 4,
                  background: fill,
                  opacity: replay && won && last ? 0.55 : 1,
                  display: 'block',
                }}
              />
            ))}
          </span>
        );
      })}
    </span>
  );
}

interface CalendarCellProps {
  day: number;
  entry: ArchiveEntry | undefined;
  future: boolean;
  isToday: boolean;
  loading: boolean;
  inStreak: boolean;
  onClick: () => void;
}

function CalendarCell({ day, entry, future, isToday, loading, inStreak, onClick }: CalendarCellProps) {
  const isPlayable = !future && !!entry && !loading;
  const isRevealed = !!entry?.played && !future;
  const wasReplay = entry?.status === 'won' && entry?.played_on_day === false;

  return (
    <button
      type="button"
      disabled={!isPlayable}
      onClick={isPlayable ? onClick : undefined}
      aria-label={
        entry
          ? `${entry.date}${entry.played ? `, ${entry.status === 'won' ? (wasReplay ? 'solved later as a replay' : 'solved') : entry.status === 'lost' ? 'not solved' : 'unfinished'}, ${entry.guesses} guess${entry.guesses !== 1 ? 'es' : ''}` : ', not played yet'}${isToday ? ', today' : ''}`
          : `Day ${day}`
      }
      aria-current={isToday ? 'date' : undefined}
      className={clsx(
        'relative flex flex-col justify-between p-1.5 md:p-2 text-left select-none min-w-0 aspect-square',
        'border-r border-b border-border-subtle transition-colors duration-fast',
        inStreak && 'bg-wash-ochre',
        isPlayable && 'cursor-pointer hover:bg-bg-elevated focus-visible:z-10',
        !isPlayable && 'cursor-default',
        future && 'text-text-tertiary',
        loading && 'skeleton'
      )}
    >
      {/* Today — outlined in accent (inset so the grid rules stay crisp) */}
      {isToday && <span className="pointer-events-none absolute inset-0 border-2 border-accent" aria-hidden="true" />}

      <span
        className={clsx(
          'font-mono text-[11px] md:text-xs tabular leading-none',
          future ? 'text-text-tertiary' : isRevealed ? 'text-text-primary' : 'text-text-secondary'
        )}
      >
        {String(day).padStart(2, '0')}
      </span>

      {isRevealed && entry && (
        <span className="flex items-end justify-between gap-1 w-full">
          <DayGrid entry={entry} replay={wasReplay} />
          <span className={clsx('font-display font-bold text-[11px] md:text-xs tabular leading-none', entry.status === 'won' ? 'text-text-primary' : 'text-text-secondary')}>
            {entry.status === 'lost' ? 'X' : entry.guesses}
            {wasReplay && <span className="text-text-tertiary font-mono font-normal">*</span>}
          </span>
        </span>
      )}
    </button>
  );
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function Archive() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed

  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const [replayingDate, setReplayingDate] = useState<string | null>(null);

  const fetchMonth = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError('');
    try {
      const res = await dailyApi.archive(year, month);
      setEntries(res.data as ArchiveEntry[]);
    } catch {
      setError('Could not load past dailies. Try again.');
    } finally {
      setFetching(false);
    }
  }, [user, year, month]);

  useEffect(() => {
    fetchMonth();
  }, [fetchMonth]);

  const handlePrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    const ny = now.getFullYear();
    const nm = now.getMonth() + 1;
    if (year > ny || (year === ny && month >= nm)) return; // can't go past current month
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isNextDisabled = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);

  // Derive runs of consecutive *played-on-the-day* daily wins in the
  // visible month. Replay-won days don't count toward streaks (the user
  // didn't actually maintain a streak on those dates).
  // Returns:
  //   - `pastStreaks`: list of run lengths (≥ 2) for the chip row
  //   - `streakDates`: set of date strings that belong to ANY run ≥ 2,
  //     used to mark those cells visually on the calendar
  const { pastStreaks, streakDates } = useMemo<{
    pastStreaks: number[];
    streakDates: Set<string>;
  }>(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const runs: number[] = [];
    const allRunDates: string[][] = [];
    let currentRun: string[] = [];
    let prevDate: string | null = null;
    for (const e of sorted) {
      const qualifies = e.played && e.status === 'won' && e.played_on_day === true;
      if (qualifies) {
        if (prevDate) {
          const prev = new Date(prevDate + 'T00:00:00');
          const next = new Date(e.date + 'T00:00:00');
          const dayDiff = Math.round((next.getTime() - prev.getTime()) / 86400000);
          if (dayDiff === 1) {
            currentRun.push(e.date);
          } else {
            if (currentRun.length > 0) {
              runs.push(currentRun.length);
              allRunDates.push(currentRun);
            }
            currentRun = [e.date];
          }
        } else {
          currentRun = [e.date];
        }
        prevDate = e.date;
      } else {
        if (currentRun.length > 0) {
          runs.push(currentRun.length);
          allRunDates.push(currentRun);
        }
        currentRun = [];
        prevDate = null;
      }
    }
    if (currentRun.length > 0) {
      runs.push(currentRun.length);
      allRunDates.push(currentRun);
    }
    const streakDates = new Set<string>();
    for (const run of allRunDates) {
      if (run.length >= 2) for (const d of run) streakDates.add(d);
    }
    return { pastStreaks: runs.filter((r) => r >= 2), streakDates };
  }, [entries]);

  const handleCellClick = async (entry: ArchiveEntry) => {
    if (replayingDate) return;
    setReplayingDate(entry.date);
    try {
      const res = await dailyApi.replay(entry.date);
      const gameId: string = res.data.id;
      router.push(`/game/${gameId}`);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || 'Could not open that day. Try again.');
      setReplayingDate(null);
    }
  };

  // Build grid
  const firstDow = getFirstDayOfWeek(year, month);
  const daysInMonth = getDaysInMonth(year, month);
  const entryMap = Object.fromEntries(entries.map((e) => [e.date, e]));
  const totalCells = firstDow + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  const today = todayStr();

  // Month summary for the stat row
  const playedThisMonth = entries.filter((e) => e.played).length;
  const wonThisMonth = entries.filter((e) => e.status === 'won').length;
  const unplayedPast = entries.filter((e) => !e.played && !isFutureDate(e.date)).length;
  const firstUnplayed = [...entries]
    .filter((e) => !e.played && !isFutureDate(e.date))
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  // Unauthenticated state
  if (!authLoading && !user) {
    return (
      <div className="min-h-page flex items-center">
        <div className="w-full bg-bg-ink text-text-on-ink">
          <div className="max-w-6xl mx-auto px-4 md:px-8 py-16 md:py-24 flex flex-col md:flex-row md:items-end justify-between gap-8">
            <div>
              <Label className="block mb-3 text-text-on-ink opacity-70">past dailies</Label>
              <SplitWords text="Sign in to see your past dailies." as="h1" className="font-display text-display-lg" />
              <p className="text-base opacity-80 mt-4">Replay any day you missed. We can only keep your days when you have an account.</p>
            </div>
            <Button variant="primary" size="lg" onClick={() => router.push('/login?next=%2Farchive')}>
              Sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10 md:gap-12">
      {/* ── Title ───────────────────────────────────────────────────────── */}
      <header className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7">
          <Label className="block mb-3">you · daily</Label>
          <SplitWords text="Past dailies" as="h1" className="font-display text-display-lg text-text-primary" />
          <p className="text-sm text-text-secondary mt-4 max-w-md">Replay any day you missed. Replays don&apos;t count toward your streak.</p>
        </div>
        <div className="md:col-span-5 rule-top pt-1 grid grid-cols-3 gap-x-6">
          <Stat size="sm" label="streak" value={user?.current_streak ?? 0} sub={<Hint term="streak">days in a row</Hint>} />
          <Stat size="sm" label="longest streak" value={user?.max_streak ?? 0} sub="your best run" />
          <Stat
            size="sm"
            label="this month"
            value={fetching && entries.length === 0 ? '—' : `${wonThisMonth}/${playedThisMonth}`}
            sub="solved / played"
          />
        </div>
      </header>

      {/* ── Calendar ────────────────────────────────────────────────────── */}
      <Reveal as="section" aria-label="Calendar of past dailies" className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10">
        <div className="md:col-span-8 min-w-0">
          {/* Month nav */}
          <div className="flex items-end justify-between gap-4 mb-4">
            <h2 className="font-display text-display-md text-text-primary" aria-live="polite">
              {MONTH_NAMES[month - 1]} <span className="text-text-tertiary">{year}</span>
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" onClick={handlePrev} disabled={fetching} aria-label="Previous month" className="!px-2.5">
                <ChevronLeft size={14} aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleNext} disabled={isNextDisabled || fetching} aria-label="Next month" className="!px-2.5">
                <ChevronRight size={14} aria-hidden="true" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 bg-wash-accent px-4 py-3 text-sm text-text-primary" role="alert">
              {error}
            </div>
          )}

          {/* Strict grid: 2px ink top rule, hair rules between every cell */}
          <div className="rule-top border-l border-border-subtle" style={{ opacity: fetching && entries.length > 0 ? 0.6 : 1, transition: 'opacity 140ms ease' }}>
            <div className="grid grid-cols-7" aria-hidden="true">
              {WEEKDAYS.map((d, i) => (
                <div key={i} className="py-2 px-1.5 md:px-2 border-r border-b border-border-subtle">
                  <Label className="text-text-tertiary">{d}</Label>
                </div>
              ))}
            </div>

            {fetching && entries.length === 0 ? (
              <div className="grid grid-cols-7">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square border-r border-b border-border-subtle skeleton" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDow }).map((_, i) => (
                  <div key={`blank-${i}`} className="aspect-square border-r border-b border-border-subtle bg-bg-muted" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const future = isFutureDate(dateStr);
                  const entry = entryMap[dateStr];
                  return (
                    <CalendarCell
                      key={dateStr}
                      day={day}
                      entry={entry}
                      future={future}
                      isToday={dateStr === today}
                      loading={replayingDate === dateStr}
                      inStreak={streakDates.has(dateStr)}
                      onClick={() => entry && handleCellClick(entry)}
                    />
                  );
                })}

                {Array.from({ length: rows * 7 - totalCells }).map((_, i) => (
                  <div key={`trail-${i}`} className="aspect-square border-r border-b border-border-subtle bg-bg-muted" />
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-5 flex-wrap font-mono text-label uppercase text-text-tertiary">
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2" style={{ background: 'var(--tile-correct)' }} aria-hidden="true" />solved</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2" style={{ background: 'var(--tile-absent)' }} aria-hidden="true" />not solved</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2" style={{ background: 'var(--tile-present)' }} aria-hidden="true" />unfinished</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 bg-wash-ochre border border-border-subtle" aria-hidden="true" />part of a streak</span>
            <span>* solved later as a replay</span>
          </div>
        </div>

        {/* ── Side column: streaks this month + replay CTA ─────────────── */}
        <aside className="md:col-span-4 flex flex-col gap-8">
          <div className="rule-top pt-3">
            <Label className="block mb-2">streaks this month</Label>
            {pastStreaks.length > 0 ? (
              <div className="flex flex-wrap gap-2" aria-label="Past streak runs this month">
                {pastStreaks.map((len, i) => (
                  <span key={i} aria-label={`${len}-day streak`}>
                    <Tag tone="ochre">{len} days</Tag>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">No two days in a row yet. Solve today&apos;s and tomorrow&apos;s to start one.</p>
            )}
          </div>

          <div className="rule-top pt-3">
            <Label className="block mb-2">days you missed</Label>
            <p className="font-display text-display-md text-text-primary tabular">
              {unplayedPast}
              <span className="text-text-tertiary text-display-sm"> day{unplayedPast !== 1 ? 's' : ''}</span>
            </p>
            <p className="text-sm text-text-secondary mt-2">
              {firstUnplayed ? 'Tap any open day in the calendar, or start with the most recent one.' : 'You have played every day this month so far.'}
            </p>
            {firstUnplayed && (
              <Button
                variant="primary"
                size="md"
                className="mt-5"
                onClick={() => handleCellClick(firstUnplayed)}
                loading={replayingDate === firstUnplayed.date}
                disabled={!!replayingDate}
              >
                Replay {firstUnplayed.date.slice(5).replace('-', '/')}
              </Button>
            )}
          </div>
        </aside>
      </Reveal>
    </div>
  );
}
