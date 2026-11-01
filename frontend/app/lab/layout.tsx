import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Word Lab',
  description:
    'Type any five-letter word and see how many of the 2,309 possible answers it rules out — or rebuild a board you played and see the best next guess.',
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
