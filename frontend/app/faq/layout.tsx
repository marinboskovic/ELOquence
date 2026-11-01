import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help',
  description: 'How to play, what skill, luck and narrowing mean, and how your rating works — in plain words.',
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
