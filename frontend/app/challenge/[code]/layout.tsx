import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Challenge',
  description: 'Play a friend\'s challenge word and compare results.',
};

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
