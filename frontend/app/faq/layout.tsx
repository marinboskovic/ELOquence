import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'How ELO, accuracy and move classification work in ELOquence.',
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
