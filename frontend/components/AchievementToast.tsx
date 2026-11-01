'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui';

export const ACHIEVEMENT_META: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  // Solving
  first_win:    { name: 'First Win',    description: 'Solve your first puzzle',       icon: '🏁' },
  quick_solve:  { name: 'Quick Solve',  description: 'Win in 3 guesses or fewer',     icon: '⚡' },
  bullseye:     { name: 'Bullseye',     description: 'Win in 2 guesses',              icon: '🎯' },
  hole_in_one:  { name: 'Hole in One',  description: 'Win in 1 guess',                icon: '🏆' },
  last_chance:  { name: 'Last Chance',  description: 'Win on your 6th guess',         icon: '🛡' },

  // Accuracy
  sharpshooter: { name: 'Sharpshooter', description: 'Hit 90%+ accuracy in a game',   icon: '🎯' },
  precision:    { name: 'Precision',    description: 'Hit 95%+ accuracy in a game',   icon: '💎' },
  perfect_game: { name: 'Perfect Game', description: 'Hit 100% accuracy in a game',   icon: '✨' },

  // Streaks
  streak_7:     { name: 'On Fire',     description: '7-day daily streak',             icon: '🔥' },
  streak_30:    { name: 'Dedicated',   description: '30-day daily streak',            icon: '📅' },
  streak_100:   { name: 'Unstoppable', description: '100-day daily streak',           icon: '🏆' },

  // Rating
  reach_veteran:     { name: 'Veteran',     description: 'Reach 1200 ELO',                 icon: '⚔️' },
  reach_master:      { name: 'Master',      description: 'Reach 1400 ELO',                 icon: '🏅' },
  reach_grandmaster: { name: 'Grandmaster', description: 'Reach 1600 ELO',                 icon: '👑' },
  upset:             { name: 'Upset',       description: 'Beat a word 200+ ELO above you', icon: '📈' },

  // Variety
  regular:        { name: 'Regular',        description: 'Play 25 games',                                icon: '🎮' },
  dedicated_100:  { name: 'Centurion',      description: 'Play 100 games',                               icon: '💯' },
  marathon:       { name: 'Marathon',       description: 'Play 200 games',                               icon: '🏃' },
  legend_500:     { name: 'Legend',         description: 'Play 500 games',                               icon: '🌟' },
  triathlete:     { name: 'Triathlete',     description: 'Play Daily, Competitive, and Practice',        icon: '🎲' },
  all_modes_won:  { name: 'Complete Set',   description: 'Win in every game mode',                       icon: '🃏' },
  trendsetter:    { name: 'Trendsetter',    description: 'Create 5 challenges',                          icon: '📤' },
  daily_devotee:  { name: 'Daily Devotee',  description: 'Solve 30 daily puzzles',                       icon: '📆' },
  daily_marathon: { name: 'Daily Marathon', description: 'Solve 100 daily puzzles',                      icon: '🗓️' },
  three_master:   { name: 'Three Master',   description: 'Win in exactly 3 guesses 25 times',            icon: '3️⃣' },

  // Mastery
  brilliant_play:     { name: 'Brilliant',         description: 'Land a brilliant move in a win',           icon: '🌠' },
  flawless:           { name: 'Flawless',          description: 'Win with no blunders or mistakes',         icon: '🪶' },
  clean_play:         { name: 'Clean Play',        description: 'Win with no constraint violations',        icon: '🧹' },
  hardcore:           { name: 'Hardcore',          description: 'Win 10 hard-mode games',                   icon: '🛡️' },
  iron_will:          { name: 'Iron Will',         description: 'Win 50 hard-mode games',                   icon: '⚒️' },
  challenge_winner:   { name: 'Challenge Master',  description: 'Win 10 challenges',                        icon: '🤝' },
  hardword_hunter:    { name: 'Hardword Hunter',   description: 'Beat 10 words rated 1600+',                icon: '🗡️' },
  placement_complete: { name: 'Calibrated',        description: 'Finish all 5 placement games',             icon: '🎓' },
  accuracy_iron:      { name: 'Iron Accuracy',     description: 'Score 85%+ in 5 games in a row',           icon: '📐' },

  // Timing
  speedster:   { name: 'Speedster',  description: 'Win a game in under 60 seconds', icon: '⚡' },
  blitz:       { name: 'Blitz',      description: 'Win a game in under 30 seconds', icon: '💨' },
  early_bird:  { name: 'Early Bird', description: 'Win 10 games before 9 AM',       icon: '🌅' },
  night_owl:   { name: 'Night Owl',  description: 'Win 10 games after 9 PM',        icon: '🌙' },
};

interface AchievementToastProps {
  achievements: Array<{ type: string; name: string; icon: string }>;
  onDismiss: () => void;
}

/**
 * One unlocked badge as an ink strip: mono eyebrow, badge name in display
 * type. The emoji in ACHIEVEMENT_META stays available to other screens but
 * is not rendered here (DESIGN.md: no emoji as icons).
 */
function SingleToast({
  achievement,
  index,
  onDismiss,
}: {
  achievement: { type: string; name: string; icon: string };
  index: number;
  onDismiss: () => void;
}) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), 4000 + index * 400);
    return () => clearTimeout(timer);
  }, [index]);

  const description = ACHIEVEMENT_META[achievement.type]?.description;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1], delay: index * 0.1 }}
      className="w-full text-left flex items-stretch bg-bg-ink text-text-on-ink border-2 border-border-default shadow-ink cursor-pointer select-none"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      aria-label={`Achievement unlocked: ${achievement.name}`}
    >
      {/* accent stripe: the live indicator */}
      <span className="w-1.5 shrink-0 bg-accent" aria-hidden="true" />
      <span className="flex flex-col min-w-0 px-4 py-3">
        <Label className="!text-text-on-ink opacity-70">achievement unlocked</Label>
        <span className="font-display text-display-sm leading-none mt-1 truncate">{achievement.name}</span>
        {description && (
          <span className="font-mono text-[11px] mt-1.5 opacity-70 truncate">{description.toLowerCase()}</span>
        )}
      </span>
    </motion.button>
  );
}

export default function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  return (
    <AnimatePresence>
      {achievements.length > 0 && (
        <div
          className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[65] flex flex-col items-stretch gap-2 w-[min(100vw-2rem,22rem)]"
          style={{ top: 'calc(var(--nav-h) + 16px)' }}
        >
          {achievements.map((ach, i) => (
            <div key={ach.type} className="pointer-events-auto w-full">
              <SingleToast achievement={ach} index={i} onDismiss={onDismiss} />
            </div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
