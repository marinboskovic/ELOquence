import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Review',
  description: 'Move-by-move analysis of a finished game.',
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
