import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Opener Lab · ELOquence',
  description:
    'Information theory, interactive. Analyse any Wordle opener, see how it splits the answer pool, and ask the engine what to guess next.',
};

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
