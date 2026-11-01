import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Past dailies',
  description: 'Replay any daily you missed.',
};

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
