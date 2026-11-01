import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Learn',
  description: 'Short lessons that make your Wordle guesses better — from reading the colours to hard mode.',
};

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return children;
}
