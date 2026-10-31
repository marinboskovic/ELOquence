import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Player profile · ELOquence',
  description: 'Public ELOquence player profile — rating, streaks, guess distribution and recent games.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
