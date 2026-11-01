import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your profile',
  description: 'Your rating, streak and every game you played.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
