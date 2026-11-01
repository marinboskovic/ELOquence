'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, ShieldCheck, Settings } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRatingTier } from '@/lib/types';
import clsx from 'clsx';

export const NAV_HEIGHT = 56;

// Routes an admin should never land on — they're not a player.
const PLAYER_ROUTE_PREFIXES = ['/play', '/dashboard', '/leaderboard', '/archive', '/learn', '/achievements', '/game/', '/review/', '/challenge/'];

function isPlayerRoute(pathname: string): boolean {
  return PLAYER_ROUTE_PREFIXES.some((p) => pathname === p || pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

const GUEST_NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/lab', label: 'Lab' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/faq', label: 'FAQ' },
];

const AUTH_NAV_LINKS = [
  { href: '/play', label: 'Play' },
  { href: '/lab', label: 'Lab' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/archive', label: 'Archive' },
  { href: '/learn', label: 'Learn' },
  { href: '/achievements', label: 'Achievements' },
  { href: '/faq', label: 'FAQ' },
];

function isLinkActive(pathname: string, href: string): boolean {
  if (href === '/play') return pathname === href || pathname.startsWith('/game/');
  return pathname === href || pathname.startsWith(href + '/');
}

export default function Navigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = !!user?.is_admin;
  const tier = user && !isAdmin ? getRatingTier(user.elo_rating) : null;

  useEffect(() => {
    if (!isAdmin) return;
    if (pathname === '/' || isPlayerRoute(pathname)) router.replace('/admin');
  }, [isAdmin, pathname, router]);

  // Close the sheet on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push('/');
    setMobileOpen(false);
  };

  const navLinks = isAdmin ? [] : user ? AUTH_NAV_LINKS : GUEST_NAV_LINKS;
  const logoHref = isAdmin ? '/admin' : '/';

  return (
    <header className="sticky top-0 z-50 bg-bg-base/95 backdrop-blur-[2px] border-b border-border-subtle" style={{ height: NAV_HEIGHT }}>
      <div className="max-w-6xl mx-auto px-4 md:px-8 h-full flex items-center justify-between gap-6">
        {/* Wordmark */}
        <Link
          href={logoHref}
          className="font-display font-black text-[22px] tracking-[-0.04em] text-text-primary flex items-center gap-2 no-underline"
          aria-label={isAdmin ? 'Admin home' : 'ELOquence home'}
        >
          <span className="relative">
            ELOquence
            <span className="absolute -right-2 top-1 w-1.5 h-1.5 bg-accent" aria-hidden="true" />
          </span>
          {isAdmin && (
            <span className="ml-2 inline-flex items-center gap-1 px-1.5 h-5 border border-border-default font-mono text-[9px] uppercase tracking-[0.14em]">
              <ShieldCheck size={9} />
              Admin
            </span>
          )}
        </Link>

        {/* Desktop links */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main navigation">
          {navLinks.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'ink-link px-1 text-[13px] font-medium tracking-[0.01em] transition-colors duration-fast',
                  active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                )}
                style={active ? { backgroundImage: 'linear-gradient(var(--accent), var(--accent))' } : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              {!isAdmin && tier && (
                <Link
                  href={`/u/${encodeURIComponent(user.username)}`}
                  className="flex items-baseline gap-2 py-2 no-underline group"
                  aria-label={`ELO rating ${Math.round(user.elo_rating)}, ${tier.name}. View your profile`}
                  title="Your public profile"
                >
                  <span className="font-display font-black text-lg tabular text-text-primary leading-none">{Math.round(user.elo_rating)}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: tier.color }}>
                    {tier.name}
                  </span>
                </Link>
              )}
              <span className="w-px h-4 bg-border-subtle" aria-hidden="true" />
              <span className="text-[13px] text-text-secondary">{user.username}</span>
              <Link
                href="/settings"
                aria-current={pathname === '/settings' ? 'page' : undefined}
                className={clsx('p-2 transition-colors duration-fast', pathname === '/settings' ? 'text-accent' : 'text-text-secondary hover:text-text-primary')}
                aria-label="Settings"
              >
                <Settings size={16} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              <button onClick={handleLogout} className="p-1.5 text-text-secondary hover:text-text-primary transition-colors duration-fast" aria-label="Log out">
                <LogOut size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          ) : (
            <Link href="/login" className="ink-link px-1 text-[13px] font-medium text-text-primary">
              Sign in →
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden p-1.5 text-text-primary"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-panel"
        >
          {mobileOpen ? <X size={22} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile sheet: full-bleed editorial list */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav-panel"
            role="navigation"
            aria-label="Mobile navigation"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="md:hidden absolute left-0 right-0 bg-bg-base border-b-2 border-border-default max-h-[calc(100dvh-56px)] overflow-y-auto"
            style={{ top: NAV_HEIGHT }}
          >
            <ul className="px-4 py-2">
              {navLinks.map((link, i) => {
                const active = isLinkActive(pathname, link.href);
                return (
                  <motion.li
                    key={link.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.03 * i, duration: 0.26 }}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <Link
                      href={link.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx('flex items-center justify-between py-3.5 font-display text-2xl font-bold tracking-[-0.03em] no-underline', active ? 'text-text-primary' : 'text-text-secondary')}
                    >
                      {link.label}
                      {active && <span className="w-2 h-2 bg-accent" aria-hidden="true" />}
                    </Link>
                  </motion.li>
                );
              })}
            </ul>
            <div className="px-4 py-4 border-t-2 border-border-default flex items-center justify-between gap-3">
              {user ? (
                <>
                  <div className="flex items-baseline gap-2 min-w-0">
                    {!isAdmin && tier && (
                      <Link href={`/u/${encodeURIComponent(user.username)}`} className="font-display font-black text-xl tabular text-text-primary no-underline">
                        {Math.round(user.elo_rating)}
                      </Link>
                    )}
                    <span className="text-sm text-text-secondary truncate">{user.username}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link href="/settings" className="p-2 text-text-secondary" aria-label="Settings">
                      <Settings size={18} strokeWidth={1.75} />
                    </Link>
                    <button onClick={handleLogout} className="p-2 text-text-secondary" aria-label="Log out">
                      <LogOut size={18} strokeWidth={1.75} />
                    </button>
                  </div>
                </>
              ) : (
                <Link href="/login" className="font-mono text-xs uppercase tracking-[0.14em] text-text-primary">
                  Sign in →
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
