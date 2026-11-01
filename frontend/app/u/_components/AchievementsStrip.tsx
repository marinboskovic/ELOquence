'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { PublicProfile } from '@/lib/api';
import { ACHIEVEMENT_META } from '@/components/AchievementToast';
import { Label, Reveal, Tag, staggerChild, staggerParent } from '@/components/ui';

export default function AchievementsStrip({ achievements, isOwner }: { achievements: PublicProfile['achievements']; isOwner: boolean }) {
  const sorted = useMemo(
    () =>
      [...achievements].sort((a, b) => {
        const ta = a.unlocked_at ? new Date(a.unlocked_at).getTime() : 0;
        const tb = b.unlocked_at ? new Date(b.unlocked_at).getTime() : 0;
        return tb - ta;
      }),
    [achievements]
  );

  return (
    <Reveal as="section" aria-label="Achievements">
      <div className="rule-top pt-3 flex items-end justify-between gap-4">
        <div>
          <Label className="block mb-1">achievements</Label>
          <h2 className="font-display text-display-md text-text-primary">
            {sorted.length > 0 ? `${sorted.length} unlocked` : 'Achievements'}
          </h2>
        </div>
        <Link href="/achievements" className="ink-link font-mono text-label uppercase text-text-primary">
          {isOwner ? 'all achievements →' : 'see them all →'}
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">
          {isOwner ? 'Nothing unlocked yet. Solve your first word to get the first one.' : 'Nothing unlocked yet.'}
        </p>
      ) : (
        <motion.ul className="mt-4 flex flex-wrap gap-2" role="list" variants={staggerParent} initial="hidden" animate="show">
          {sorted.map((a) => {
            const meta = ACHIEVEMENT_META[a.type];
            const unlocked = a.unlocked_at
              ? new Date(a.unlocked_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : null;
            return (
              <motion.li key={a.type} variants={staggerChild}>
                <Tag tone="neutral" className="!h-7 !text-[11px] text-text-primary border-border-default">
                  <span title={[meta?.description, unlocked ? `Unlocked ${unlocked}` : null].filter(Boolean).join(' · ')}>
                    {meta?.name ?? a.type.replace(/_/g, ' ')}
                  </span>
                </Tag>
              </motion.li>
            );
          })}
        </motion.ul>
      )}
    </Reveal>
  );
}
