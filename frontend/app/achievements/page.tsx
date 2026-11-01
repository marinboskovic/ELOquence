'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Flag,
  Zap,
  Target,
  Award,
  ShieldCheck,
  Crosshair,
  Gem,
  Sparkles,
  Flame,
  CalendarDays,
  Trophy,
  Swords,
  Medal,
  Crown,
  TrendingUp,
  Hash,
  Activity,
  Layers,
  Star,
  Feather,
  Brush,
  Shield,
  Hammer,
  Handshake,
  Sword,
  GraduationCap,
  Ruler,
  Calendar,
  CalendarCheck,
  Dice3,
  Send,
  Boxes,
  Rocket,
  Sunrise,
  Moon,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { achievementsApi } from '@/lib/api';
import { ACHIEVEMENT_META } from '@/components/AchievementToast';
import { CountUp, Label, SplitWords, Tag, staggerChild, staggerParent } from '@/components/ui';

interface AchievementDef {
  type: string;
  name: string;
  description: string;
  icon: string;
}

interface UnlockedAchievement {
  type: string;
  unlocked_at: string;
}

// ─── Categories ──────────────────────────────────────────────────────────────

type Category = 'solving' | 'accuracy' | 'streaks' | 'rating' | 'variety' | 'mastery' | 'timing';

const CATEGORY_FOR_TYPE: Record<string, Category> = {
  // Solving
  first_win:         'solving',
  quick_solve:       'solving',
  bullseye:          'solving',
  hole_in_one:       'solving',
  last_chance:       'solving',
  three_master:      'solving',
  // Accuracy
  sharpshooter:      'accuracy',
  precision:         'accuracy',
  perfect_game:      'accuracy',
  accuracy_iron:     'accuracy',
  // Streaks
  streak_7:          'streaks',
  streak_30:         'streaks',
  streak_100:        'streaks',
  daily_devotee:     'streaks',
  daily_marathon:    'streaks',
  // Rating
  reach_veteran:     'rating',
  reach_master:      'rating',
  reach_grandmaster: 'rating',
  upset:             'rating',
  placement_complete:'rating',
  hardword_hunter:   'rating',
  // Variety
  regular:           'variety',
  dedicated_100:     'variety',
  marathon:          'variety',
  legend_500:        'variety',
  triathlete:        'variety',
  all_modes_won:     'variety',
  trendsetter:       'variety',
  // Mastery
  brilliant_play:    'mastery',
  flawless:          'mastery',
  clean_play:        'mastery',
  hardcore:          'mastery',
  iron_will:         'mastery',
  challenge_winner:  'mastery',
  // Timing
  speedster:         'timing',
  blitz:             'timing',
  early_bird:        'timing',
  night_owl:         'timing',
};

const ICON_FOR_TYPE: Record<string, LucideIcon> = {
  // Solving
  first_win:    Flag,
  quick_solve:  Zap,
  bullseye:     Target,
  hole_in_one:  Award,
  last_chance:  ShieldCheck,
  three_master: Dice3,
  // Accuracy
  sharpshooter: Crosshair,
  precision:    Gem,
  perfect_game: Sparkles,
  accuracy_iron: Ruler,
  // Streaks
  streak_7:        Flame,
  streak_30:       CalendarDays,
  streak_100:      Trophy,
  daily_devotee:   Calendar,
  daily_marathon:  CalendarCheck,
  // Rating
  reach_veteran:      Swords,
  reach_master:       Medal,
  reach_grandmaster:  Crown,
  upset:              TrendingUp,
  placement_complete: GraduationCap,
  hardword_hunter:    Sword,
  // Variety
  regular:        Hash,
  dedicated_100:  Activity,
  marathon:       Activity,
  legend_500:     Star,
  triathlete:     Layers,
  all_modes_won:  Boxes,
  trendsetter:    Send,
  // Mastery
  brilliant_play:   Star,
  flawless:         Feather,
  clean_play:       Brush,
  hardcore:         Shield,
  iron_will:        Hammer,
  challenge_winner: Handshake,
  // Timing
  speedster:  Zap,
  blitz:      Rocket,
  early_bird: Sunrise,
  night_owl:  Moon,
};

const CATEGORY_LABEL: Record<Category, string> = {
  solving:  'solving',
  accuracy: 'accuracy',
  streaks:  'streaks',
  rating:   'rating',
  variety:  'variety',
  mastery:  'mastery',
  timing:   'timing',
};

const CATEGORY_ORDER: Category[] = ['solving', 'accuracy', 'streaks', 'rating', 'mastery', 'timing', 'variety'];

interface MergedAchievement {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: Category;
}

// ─── Achievement row ─────────────────────────────────────────────────────────

function AchievementRow({ ach, unlockedAt }: { ach: MergedAchievement; unlockedAt: string | undefined }) {
  const isUnlocked = !!unlockedAt;
  const Icon = ICON_FOR_TYPE[ach.type];

  return (
    <motion.li
      variants={staggerChild}
      className={clsx(
        'rule-hair flex items-start gap-4 py-4 transition-colors duration-fast',
        isUnlocked ? 'bg-bg-base hover:bg-bg-elevated' : 'opacity-55'
      )}
    >
      {/* Glyph: lucide icon in a small ink square (emoji falls back to the same square) */}
      <span
        className={clsx(
          'shrink-0 w-9 h-9 flex items-center justify-center',
          isUnlocked ? 'bg-bg-ink text-text-on-ink' : 'border border-border-subtle text-text-tertiary'
        )}
        aria-hidden="true"
      >
        {Icon ? <Icon size={16} strokeWidth={2} /> : <span style={{ fontSize: 14 }}>{ach.icon}</span>}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className={clsx('font-display text-display-sm', isUnlocked ? 'text-text-primary' : 'text-text-secondary')}>
            {ach.name}
          </span>
          {isUnlocked && unlockedAt ? (
            <span className="shrink-0 font-mono text-[11px] tabular text-text-tertiary">
              {new Date(unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase()}
            </span>
          ) : (
            <Tag tone="neutral" className="shrink-0">locked</Tag>
          )}
        </div>
        <p className="text-sm text-text-secondary mt-1 leading-snug">{ach.description}</p>
      </div>
    </motion.li>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="rule-hair flex items-start gap-4 py-4">
      <div className="w-9 h-9 skeleton bg-bg-muted shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-3.5 w-32 skeleton bg-bg-muted" />
        <div className="h-3 w-48 skeleton bg-bg-muted" />
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AchievementsPage() {
  const [allAchievements, setAllAchievements] = useState<AchievementDef[]>([]);
  const [unlocked, setUnlocked] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | Category>('all');

  useEffect(() => {
    Promise.all([achievementsApi.all(), achievementsApi.mine()])
      .then(([allRes, mineRes]) => {
        setAllAchievements(allRes.data);
        setUnlocked(mineRes.data);
      })
      .catch(() => setError('Failed to load achievements.'))
      .finally(() => setLoading(false));
  }, []);

  const unlockedMap = useMemo(
    () => new Map(unlocked.map((u) => [u.type, u.unlocked_at])),
    [unlocked],
  );

  const mergedAchievements: MergedAchievement[] = useMemo(
    () =>
      allAchievements.map((a) => {
        const meta = ACHIEVEMENT_META[a.type];
        return {
          type: a.type,
          name: a.name || meta?.name || a.type,
          description: a.description || meta?.description || '',
          icon: a.icon || meta?.icon || '🏆',
          category: CATEGORY_FOR_TYPE[a.type] ?? 'rating',
        };
      }),
    [allAchievements],
  );

  const filteredAchievements = useMemo(
    () =>
      filter === 'all'
        ? mergedAchievements
        : mergedAchievements.filter((a) => a.category === filter),
    [mergedAchievements, filter],
  );

  const grouped: Array<{ category: Category; items: MergedAchievement[] }> = useMemo(() => {
    const map: Record<Category, MergedAchievement[]> = {
      solving: [], accuracy: [], streaks: [], rating: [], variety: [], mastery: [], timing: [],
    };
    for (const a of filteredAchievements) map[a.category].push(a);
    return CATEGORY_ORDER
      .map((category) => ({ category, items: map[category] }))
      .filter((g) => g.items.length > 0);
  }, [filteredAchievements]);

  const unlockedCount = unlocked.length;
  const totalCount = mergedAchievements.length;
  const progressPct = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  const filterCounts = useMemo(() => {
    const counts: Record<'all' | Category, number> = {
      all: mergedAchievements.length,
      solving: 0, accuracy: 0, streaks: 0, rating: 0, variety: 0, mastery: 0, timing: 0,
    };
    for (const a of mergedAchievements) counts[a.category]++;
    return counts;
  }, [mergedAchievements]);

  const FILTERS: { key: 'all' | Category; label: string }[] = [
    { key: 'all',      label: 'all' },
    { key: 'solving',  label: 'solving' },
    { key: 'accuracy', label: 'accuracy' },
    { key: 'streaks',  label: 'streaks' },
    { key: 'rating',   label: 'rating' },
    { key: 'mastery',  label: 'mastery' },
    { key: 'timing',   label: 'timing' },
    { key: 'variety',  label: 'variety' },
  ];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16">
        <div className="space-y-3 mb-12">
          <div className="h-3 w-28 skeleton bg-bg-muted" />
          <div className="h-16 w-72 skeleton bg-bg-muted" />
          <div className="h-0.5 w-full max-w-md skeleton bg-bg-muted mt-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-16 flex flex-col gap-10 md:gap-12">
      {/* ── Progress header ──────────────────────────────────────────────── */}
      <header className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
        <div className="md:col-span-7">
          <Label className="block mb-3">achievements</Label>
          <h1 className="font-display text-display-lg text-text-primary tabular">
            <CountUp value={unlockedCount} />
            <span className="text-text-tertiary"> / {totalCount}</span>
          </h1>
          <SplitWords text="unlocked" as="p" className="font-display text-display-sm text-text-secondary mt-2" delay={0.1} />
        </div>
        <div className="md:col-span-5">
          <div className="flex items-baseline justify-between mb-2 font-mono text-label uppercase text-text-tertiary tabular">
            <span>progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div
            className="relative h-px w-full bg-bg-muted"
            role="progressbar"
            aria-valuenow={unlockedCount}
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-label={`${unlockedCount} of ${totalCount} achievements unlocked`}
          >
            <motion.div
              className="absolute left-0 bg-bg-ink"
              style={{ height: 2, top: -0.5 }}
              initial={{ width: '0%' }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1], delay: 0.2 }}
            />
          </div>
        </div>
      </header>

      {/* ── Category filter — underline strip ───────────────────────────── */}
      <div
        role="tablist"
        aria-label="Filter achievements by category"
        className="flex gap-6 overflow-x-auto hide-native-scrollbar scroll-fade-x md:[mask-image:none] border-b border-border-subtle"
      >
        {FILTERS.map((opt) => {
          const active = filter === opt.key;
          return (
            <button
              key={opt.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setFilter(opt.key)}
              className={clsx(
                'relative shrink-0 pb-3 -mb-px font-mono text-label uppercase transition-colors duration-fast',
                active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {opt.label}
              <span className="ml-1.5 tabular text-text-tertiary">{filterCounts[opt.key]}</span>
              {active && (
                <motion.span
                  layoutId="ach-tab-underline"
                  className="absolute left-0 right-0 bottom-0 h-0.5 bg-accent"
                  transition={{ duration: 0.26, ease: [0.7, 0, 0.2, 1] }}
                />
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-wash-accent px-5 py-4 text-sm text-text-primary" role="alert">
          {error}
        </div>
      )}

      {/* ── Grouped two-column list ─────────────────────────────────────── */}
      {grouped.length === 0 && !error ? (
        <div className="bg-bg-ink text-text-on-ink px-6 py-10 md:px-10 md:py-12">
          <p className="font-display text-display-md">No achievements in this category.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          {grouped.map(({ category, items }) => {
            const doneInGroup = items.filter((a) => unlockedMap.has(a.type)).length;
            const complete = doneInGroup >= items.length;
            return (
              <section key={category} aria-label={CATEGORY_LABEL[category]}>
                <header className="rule-top pt-3 flex items-end justify-between gap-4 mb-2">
                  <h2 className="font-display text-display-md text-text-primary capitalize">{CATEGORY_LABEL[category]}</h2>
                  <span className="flex items-center gap-3">
                    {complete && <Tag tone="green">complete</Tag>}
                    <span className="font-mono text-xs tabular text-text-tertiary">
                      {doneInGroup} / {items.length}
                    </span>
                  </span>
                </header>
                <motion.ul
                  role="list"
                  className="grid grid-cols-1 md:grid-cols-2 gap-x-10"
                  variants={staggerParent}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-8% 0px' }}
                >
                  {items.map((ach) => (
                    <AchievementRow key={ach.type} ach={ach} unlockedAt={unlockedMap.get(ach.type)} />
                  ))}
                </motion.ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
