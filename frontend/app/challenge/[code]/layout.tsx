import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Friends',
  description: 'Play the word a friend sent you and see who solved it.',
};

export default function ChallengeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
