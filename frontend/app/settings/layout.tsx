import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Theme, accessibility, hard mode, profile and account settings.',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
