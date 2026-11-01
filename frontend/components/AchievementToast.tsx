'use client';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Label } from '@/components/ui';

/**
 * Plain-language names and one-line goals for every badge. These win over the
 * text the API sends (which still says "ELO" and "placement") — see
 * `plainAchievementText` for anything the API adds that is not listed here.
 */
export const ACHIEVEMENT_META: Record<
  string,
  { name: string; description: string; icon: string }
> = {
  // Solving
  first_win:    { name: 'First Win',    description: 'Solve your first word',          icon: '🏁' },
  quick_solve:  { name: 'Quick Solve',  description: 'Solve in 3 guesses or fewer',    icon: '⚡' },
  bullseye:     { name: 'Bullseye',     description: 'Solve in 2 guesses',             icon: '🎯' },
  hole_in_one:  { name: 'Hole in One',  description: 'Solve with your very first guess', icon: '🏆' },
  last_chance:  { name: 'Last Chance',  description: 'Solve on your 6th and final guess', icon: '🛡' },

  // Accuracy
  sharpshooter: { name: 'Sharpshooter', description: 'Reach 90% accuracy in one game',  icon: '🎯' },
  precision:    { name: 'Precision',    description: 'Reach 95% accuracy in one game',  icon: '💎' },
  perfect_game: { name: 'Perfect Game', description: 'Reach 100% accuracy in one game', icon: '✨' },

  // Streaks
  streak_7:     { name: 'On Fire',     description: 'Solve the Daily 7 days in a row',   icon: '🔥' },
  streak_30:    { name: 'Dedicated',   description: 'Solve the Daily 30 days in a row',  icon: '📅' },
  streak_100:   { name: 'Unstoppable', description: 'Solve the Daily 100 days in a row', icon: '🏆' },

  // Rating
  reach_veteran:     { name: 'Veteran',     description: 'Reach a 1200 rating',                    icon: '⚔️' },
  reach_master:      { name: 'Master',      description: 'Reach a 1400 rating',                    icon: '🏅' },
  reach_grandmaster: { name: 'Grandmaster', description: 'Reach a 1600 rating',                    icon: '👑' },
  upset:             { name: 'Upset',       description: 'Solve a word rated 200+ above you',      icon: '📈' },

  // Variety
  regular:        { name: 'Regular',        description: 'Play 25 games',                                icon: '🎮' },
  dedicated_100:  { name: 'Centurion',      description: 'Play 100 games',                               icon: '💯' },
  marathon:       { name: 'Marathon',       description: 'Play 200 games',                               icon: '🏃' },
  legend_500:     { name: 'Legend',         description: 'Play 500 games',                               icon: '🌟' },
  triathlete:     { name: 'Triathlete',     description: 'Play a Daily, a Ranked and a Practice game',   icon: '🎲' },
  all_modes_won:  { name: 'Complete Set',   description: 'Solve a word in every mode',                   icon: '🃏' },
  trendsetter:    { name: 'Trendsetter',    description: 'Send 5 words to friends',                      icon: '📤' },
  daily_devotee:  { name: 'Daily Devotee',  description: 'Solve 30 Dailies',                             icon: '📆' },
  daily_marathon: { name: 'Daily Marathon', description: 'Solve 100 Dailies',                            icon: '🗓️' },
  three_master:   { name: 'Three Master',   description: 'Solve in exactly 3 guesses, 25 times',         icon: '3️⃣' },

  // Mastery
  brilliant_play:     { name: 'Brilliant',         description: 'Play a Brilliant guess in a game you solve',    icon: '🌠' },
  flawless:           { name: 'Flawless',          description: 'Solve a word with no Costly or Big miss guesses', icon: '🪶' },
  clean_play:         { name: 'Clean Play',        description: 'Solve a word using every clue you found',      icon: '🧹' },
  hardcore:           { name: 'Hardcore',          description: 'Solve 10 words in Hard mode',                  icon: '🛡️' },
  iron_will:          { name: 'Iron Will',         description: 'Solve 50 words in Hard mode',                  icon: '⚒️' },
  challenge_winner:   { name: 'Friends Champion',  description: 'Beat friends on 10 words they sent you',       icon: '🤝' },
  hardword_hunter:    { name: 'Hard Word Hunter',  description: 'Solve 10 words with a difficulty of 1600+',    icon: '🗡️' },
  placement_complete: { name: 'Calibrated',        description: 'Finish your first 5 Ranked games',             icon: '🎓' },
  accuracy_iron:      { name: 'Iron Accuracy',     description: 'Reach 85% accuracy in 5 games in a row',       icon: '📐' },

  // Timing
  speedster:   { name: 'Speedster',  description: 'Solve a word in under 60 seconds', icon: '⚡' },
  blitz:       { name: 'Blitz',      description: 'Solve a word in under 30 seconds', icon: '💨' },
  early_bird:  { name: 'Early Bird', description: 'Solve 10 words before 9 AM',       icon: '🌅' },
  night_owl:   { name: 'Night Owl',  description: 'Solve 10 words after 9 PM',        icon: '🌙' },
};

/**
 * Safety net for badge text that comes from the API and is not in
 * ACHIEVEMENT_META: swap the jargon for the words the rest of the app uses.
 */
export function plainAchievementText(text: string): string {
  return text
    .replace(/\bReach (\d+) ELO\b/g, 'Reach a $1 rating')
    .replace(/\bELO\b/g, 'rating')
    .replace(/\bElo\b/g, 'rating')
    .replace(/\bplacement games?\b/gi, 'first 5 games')
    .replace(/\bplacement\b/gi, 'first 5 games')
    .replace(/\bcompetitive\b/gi, 'Ranked')
    .replace(/\bchallenges\b/gi, 'words sent to friends')
    .replace(/\bchallenge\b/gi, 'friend game')
    .replace(/\bblunders?\b/gi, 'big misses')
    .replace(/\bbits\b/gi, 'narrowing');
}

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

  const meta = ACHIEVEMENT_META[achievement.type];
  const name = meta?.name ?? plainAchievementText(achievement.name);
  const description = meta?.description;

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
      aria-label={`Achievement unlocked: ${name}`}
    >
      {/* accent stripe: the live indicator */}
      <span className="w-1.5 shrink-0 bg-accent" aria-hidden="true" />
      <span className="flex flex-col min-w-0 px-4 py-3">
        <Label className="!text-text-on-ink opacity-70">achievement unlocked</Label>
        <span className="font-display text-display-sm leading-none mt-1 truncate">{name}</span>
        {description && (
          <span className="font-mono text-[11px] mt-1.5 opacity-70 truncate">{description.toLowerCase()}</span>
        )}
      </span>
    </motion.button>
  );
}

function GroupToast({ achievements, onDismiss }: { achievements: { type: string; name: string; icon: string }[]; onDismiss: () => void }) {
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), 6000);
    return () => clearTimeout(timer);
  }, []);
  const names = achievements.map((a) => ACHIEVEMENT_META[a.type]?.name ?? plainAchievementText(a.name));
  return (
    <motion.a
      href="/achievements"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full text-left flex items-stretch bg-bg-ink text-text-on-ink border-2 border-border-default shadow-ink cursor-pointer select-none no-underline"
      onClick={onDismiss}
      role="status"
      aria-live="polite"
      aria-label={`${achievements.length} achievements unlocked: ${names.join(', ')}`}
    >
      <span className="w-1.5 shrink-0 bg-accent" aria-hidden="true" />
      <span className="flex flex-col min-w-0 px-4 py-3">
        <Label className="!text-text-on-ink opacity-70">{achievements.length} achievements unlocked</Label>
        <span className="font-display text-display-sm leading-none mt-1 truncate">{names.slice(0, 2).join(' · ')}{names.length > 2 ? ` +${names.length - 2}` : ''}</span>
        <span className="font-mono text-[11px] mt-1.5 opacity-70">see them all →</span>
      </span>
    </motion.a>
  );
}

export default function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  return (
    <AnimatePresence>
      {achievements.length > 0 && (
        <div
          // Bottom-left stack so the game-over sheet stays readable.
          className="pointer-events-none fixed left-4 z-[65] flex flex-col-reverse items-stretch gap-2 w-[min(100vw-2rem,20rem)] max-h-[60dvh] overflow-hidden"
          style={{ bottom: 'calc(var(--tabbar-h, 0px) + 1rem)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {achievements.length > 2 ? (
            // Several at once (typical on a first win): one calm card instead of a wall of toasts.
            <div className="pointer-events-auto w-full">
              <GroupToast achievements={achievements} onDismiss={onDismiss} />
            </div>
          ) : (
            achievements.map((ach, i) => (
              <div key={ach.type} className="pointer-events-auto w-full">
                <SingleToast achievement={ach} index={i} onDismiss={onDismiss} />
              </div>
            ))
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
