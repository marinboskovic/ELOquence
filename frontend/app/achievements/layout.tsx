import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Achievements',
  description: 'Badges you have earned and the ones still to unlock.',
};

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
