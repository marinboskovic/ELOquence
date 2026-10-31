import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your rating, streaks, accuracy and recent games.',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
