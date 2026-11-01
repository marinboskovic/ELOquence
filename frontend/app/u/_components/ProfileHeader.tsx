'use client';
import { Pencil, Share2 } from 'lucide-react';
import type { PublicProfile } from '@/lib/api';
import { getRatingTier } from '@/lib/types';
import { TIER_COPY } from '@/lib/copy';
import { Button, ButtonLink, CountUp, DetailToggle, Hint, Label, SplitWords, Tag } from '@/components/ui';
import { tierTone } from './shared';

/**
 * Masthead: who this is, their rating as the big number, and what it means
 * (tier, first-5-games progress, streak). Owner gets Edit; everyone gets
 * Share profile; the Simple | Detailed switch sits with the actions.
 */
export default function ProfileHeader({ profile, isOwner, onShare }: { profile: PublicProfile; isOwner: boolean; onShare: () => void }) {
  const tier = getRatingTier(profile.elo_rating);
  const initial = profile.username.trim().charAt(0).toUpperCase() || '?';
  const memberSince = profile.member_since
    ? new Date(profile.member_since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase()
    : null;
  const placementGames = Math.min(profile.rated_games, 5);

  return (
    <header aria-label="Player" className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-end">
      {/* Name + rating */}
      <div className="md:col-span-7 min-w-0">
        <div className="flex items-center gap-4 min-w-0">
          {profile.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              width={56}
              height={56}
              referrerPolicy="no-referrer"
              className="w-12 h-12 md:w-14 md:h-14 object-cover shrink-0 border-2 border-border-default"
            />
          ) : (
            <div
              className="w-12 h-12 md:w-14 md:h-14 shrink-0 border-2 border-border-default text-text-primary flex items-center justify-center font-display font-black text-2xl select-none"
              aria-hidden="true"
            >
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <Label className="block mb-1">{isOwner ? 'your profile' : 'profile'}</Label>
            <SplitWords text={profile.username} as="h1" className="font-display text-display-md text-text-primary break-words" />
          </div>
        </div>

        <div className="mt-8">
          <Label className="block">
            <Hint term="rating">rating</Hint>
          </Label>
          <p className="font-display text-display-xl text-text-primary tabular mt-2 leading-none">
            <CountUp value={Math.round(profile.elo_rating)} duration={1100} format={(n) => String(Math.round(n))} />
          </p>
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Tag tone={tierTone(tier.name)}>
              <Hint title={tier.name} body={TIER_COPY[tier.name]?.simple ?? ''}>
                {tier.name}
              </Hint>
            </Tag>
            {profile.is_placement && (
              <Tag tone="ochre">
                <Hint term="placement">
                  First 5 games · {placementGames}/5
                </Hint>
              </Tag>
            )}
            {profile.current_streak > 0 && (
              <Tag tone="neutral" dot="var(--accent)">
                <Hint term="streak">Streak {profile.current_streak}</Hint>
              </Tag>
            )}
            {memberSince && <span className="font-mono text-xs text-text-tertiary tabular">since {memberSince}</span>}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="md:col-span-5 flex flex-col md:items-end gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && (
            <ButtonLink href="/settings" variant="secondary" size="sm">
              <Pencil size={13} aria-hidden="true" />
              edit
            </ButtonLink>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={onShare}>
            <Share2 size={13} aria-hidden="true" />
            share profile
          </Button>
        </div>
        <DetailToggle />
      </div>
    </header>
  );
}
