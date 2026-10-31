import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Play',
  description: 'Play the daily Wordle or practice games and climb the ELO ladder.',
};

export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
