import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description: 'Top ELOquence players by rating, season and accuracy.',
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
