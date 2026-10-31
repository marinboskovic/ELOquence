import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Archive',
  description: 'Replay any past daily Wordle puzzle.',
};

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
