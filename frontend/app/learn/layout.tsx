import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'Bite-sized lessons on information theory and Wordle strategy.',
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
