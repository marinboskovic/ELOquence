import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/hooks/useAuth';
import Navigation from '@/components/Navigation';
import AnnouncementBanner from '@/components/AnnouncementBanner';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import InstallCapture from '@/components/InstallCapture';
import MotionProvider from '@/components/MotionProvider';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { jetbrainsMono, plexSans, schibsted } from './fonts';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://el-oquence.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'ELOquence', template: '%s · ELOquence' },
  description:
    'Competitive Wordle with information-theory analysis, ELO ratings, and deep move breakdowns.',
  applicationName: 'ELOquence',
  openGraph: {
    title: 'ELOquence',
    description: 'Competitive Wordle',
    type: 'website',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ELOquence',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f3f1' },
    { media: '(prefers-color-scheme: dark)', color: '#121211' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${schibsted.variable} ${plexSans.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-[100dvh] text-text-primary antialiased bg-bg-base">
        <a href="#main" className="skip-link">Skip to content</a>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            if(localStorage.getItem('eloquence_colorblind')==='true')document.documentElement.classList.add('colorblind');
            if(localStorage.getItem('eloquence_reduced_motion')==='true')document.documentElement.classList.add('reduce-motion');
            var t=localStorage.getItem('eloquence_theme');
            if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.setAttribute('data-theme','dark');
            if(localStorage.getItem('eloquence_keyboard_only')==='true')document.documentElement.setAttribute('data-keyboard-only','true');
          })();
        `}} />
        <MotionProvider>
          <AuthProvider>
            <Navigation />
            <AnnouncementBanner />
            <main id="main" tabIndex={-1} className="relative z-10 outline-none">{children}</main>
            <InstallCapture />
          </AuthProvider>
        </MotionProvider>
        <ServiceWorkerRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
