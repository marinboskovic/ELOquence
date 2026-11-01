'use client';
/**
 * Navigation — three chapters and "you".
 *
 *   Play · Improve · Ranked                       [rating · name ▾]
 *
 * Desktop: a 56px top bar. "Improve" and "Ranked" open a small sheet with
 * their destinations and a one-line reason to go there, so a beginner never
 * has to guess what "Lab" or "Archive" means. The user chip opens the
 * personal menu (profile, archive, achievements, settings, view mode).
 *
 * Mobile: the top bar keeps only the wordmark and the chip; a 5-tab bottom
 * bar (Play · Learn · Lab · Ranked · You) does the navigating.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { type LucideIcon, LogOut, ShieldCheck, Settings, ChevronDown, Gamepad2, GraduationCap, FlaskConical, Trophy, User, HelpCircle, CalendarDays, Award, Eye } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRatingTier } from '@/lib/types';
import { useViewMode } from '@/lib/viewMode';
import { DetailToggle } from '@/components/ui';
import clsx from 'clsx';

export const NAV_HEIGHT = 56;
export const TABBAR_HEIGHT = 56;

// Routes an admin should never land on — they're not a player.
const PLAYER_ROUTE_PREFIXES = ['/play', '/dashboard', '/leaderboard', '/archive', '/learn', '/achievements', '/game/', '/review/', '/challenge/', '/u/'];
function isPlayerRoute(pathname: string): boolean {
  return PLAYER_ROUTE_PREFIXES.some((p) => pathname === p || pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

interface Dest {
  href: string;
  label: string;
  why: string;
  icon: LucideIcon;
  authOnly?: boolean;
}
interface Chapter {
  key: 'play' | 'improve' | 'ranked';
  label: string;
  href: string; // where a plain click goes
  items?: Dest[]; // when present, the chapter opens a sheet
}

const CHAPTERS: Chapter[] = [
  { key: 'play', label: 'Play', href: '/play' },
  {
    key: 'improve',
    label: 'Improve',
    href: '/learn',
    items: [
      { href: '/learn', label: 'Learn', why: 'Short lessons, from reading colours to hard mode.', icon: GraduationCap },
      { href: '/lab', label: 'Word Lab', why: 'Try any first word and see how much it tells you.', icon: FlaskConical },
      { href: '/faq', label: 'Help', why: 'What the scores mean, in plain words.', icon: HelpCircle },
    ],
  },
  {
    key: 'ranked',
    label: 'Ranked',
    href: '/leaderboard',
    items: [
      { href: '/leaderboard', label: 'Leaderboard', why: 'Every player, by rating.', icon: Trophy },
      { href: '/leaderboard?tab=season', label: 'This season', why: 'A fresh monthly ladder — new players can place.', icon: CalendarDays },
    ],
  },
];

function chapterOf(pathname: string): Chapter['key'] | 'you' | null {
  if (pathname === '/play' || pathname.startsWith('/game/') || pathname.startsWith('/challenge/')) return 'play';
  if (pathname.startsWith('/learn') || pathname.startsWith('/lab') || pathname.startsWith('/faq') || pathname.startsWith('/review/')) return 'improve';
  if (pathname.startsWith('/leaderboard')) return 'ranked';
  if (pathname.startsWith('/u/') || pathname.startsWith('/dashboard') || pathname.startsWith('/archive') || pathname.startsWith('/achievements') || pathname.startsWith('/settings')) return 'you';
  return null;
}

/* ───────────────────────── Dropdown sheet ───────────────────────── */
function Sheet({ open, children, align = 'left', id }: { open: boolean; children: React.ReactNode; align?: 'left' | 'right'; id: string }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          id={id}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          className={clsx('absolute top-full mt-2 w-72 bg-bg-base border-2 border-border-default shadow-ink z-50', align === 'left' ? 'left-0' : 'right-0')}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DestRow({ d, active, onClick }: { d: Dest; active: boolean; onClick?: () => void }) {
  const Icon = d.icon;
  return (
    <Link
      href={d.href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={clsx('flex items-start gap-3 px-4 py-3 no-underline border-b border-border-subtle last:border-0 transition-colors duration-fast hover:bg-bg-muted', active && 'bg-bg-muted')}
    >
      <Icon size={16} strokeWidth={1.75} className={clsx('mt-0.5 shrink-0', active ? 'text-accent' : 'text-text-secondary')} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text-primary">{d.label}</span>
        <span className="block text-xs text-text-secondary leading-snug">{d.why}</span>
      </span>
    </Link>
  );
}

/* ───────────────────────── Main component ───────────────────────── */
export default function Navigation() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { mode } = useViewMode();
  const [open, setOpen] = useState<null | Chapter['key'] | 'you'>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const isAdmin = !!user?.is_admin;
  const tier = user && !isAdmin ? getRatingTier(user.elo_rating) : null;
  const current = chapterOf(pathname);
  const profileHref = user ? `/u/${encodeURIComponent(user.username)}` : '/login';

  useEffect(() => {
    if (!isAdmin) return;
    if (pathname === '/' || isPlayerRoute(pathname)) router.replace('/admin');
  }, [isAdmin, pathname, router]);

  // Close sheets on route change, outside click, Escape
  useEffect(() => setOpen(null), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = useCallback(async () => {
    await logout();
    setOpen(null);
    router.push('/');
  }, [logout, router]);

  const logoHref = isAdmin ? '/admin' : '/';

  /* ---------- You menu (shared desktop/mobile sheet) ---------- */
  const youItems: Dest[] = user
    ? [
        { href: profileHref, label: 'Your profile', why: 'Rating, streak, every game you played.', icon: User },
        { href: '/archive', label: 'Past dailies', why: 'Replay any day you missed.', icon: CalendarDays },
        { href: '/achievements', label: 'Achievements', why: 'Badges for things you did.', icon: Award },
        { href: '/settings', label: 'Settings', why: 'Theme, hard mode, account.', icon: Settings },
      ]
    : [];

  return (
    <>
      <header className="sticky top-0 z-50 bg-bg-base border-b border-border-subtle" style={{ height: NAV_HEIGHT }}>
        <div ref={barRef} className="max-w-6xl mx-auto px-4 md:px-8 h-full flex items-center justify-between gap-6">
          {/* Wordmark */}
          <Link
            href={logoHref}
            className="font-display font-black text-[22px] tracking-[-0.04em] text-text-primary flex items-center gap-2 no-underline shrink-0"
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

          {/* Chapters — desktop */}
          {!isAdmin && (
            <nav className="hidden md:flex items-center gap-7 h-full" aria-label="Main navigation">
              {CHAPTERS.map((c) => {
                const active = current === c.key;
                const isOpen = open === c.key;
                if (!c.items) {
                  return (
                    <Link
                      key={c.key}
                      href={c.href}
                      aria-current={active ? 'page' : undefined}
                      className={clsx('ink-link px-1 text-[14px] font-medium tracking-[0.01em] transition-colors duration-fast', active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary')}
                      style={active ? { backgroundImage: 'linear-gradient(var(--accent), var(--accent))' } : undefined}
                    >
                      {c.label}
                    </Link>
                  );
                }
                return (
                  <div key={c.key} className="relative h-full flex items-center" onMouseEnter={() => setOpen(c.key)} onMouseLeave={() => setOpen((o) => (o === c.key ? null : o))}>
                    <button
                      type="button"
                      aria-haspopup="true"
                      aria-expanded={isOpen}
                      aria-controls={`sheet-${c.key}`}
                      onClick={() => (isOpen ? router.push(c.href) : setOpen(c.key))}
                      className={clsx('ink-link px-1 inline-flex items-center gap-1 text-[14px] font-medium tracking-[0.01em] transition-colors duration-fast', active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary')}
                      style={active ? { backgroundImage: 'linear-gradient(var(--accent), var(--accent))' } : undefined}
                    >
                      {c.label}
                      <ChevronDown size={12} strokeWidth={2} className={clsx('transition-transform duration-fast', isOpen && 'rotate-180')} aria-hidden="true" />
                    </button>
                    <Sheet open={isOpen} id={`sheet-${c.key}`}>
                      {c.items.map((d) => (
                        <DestRow key={d.href} d={d} active={pathname === d.href.split('?')[0] && (!d.href.includes('?') || pathname + '' === d.href)} onClick={() => setOpen(null)} />
                      ))}
                    </Sheet>
                  </div>
                );
              })}
            </nav>
          )}

          {/* You */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="relative h-full flex items-center">
                <button
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={open === 'you'}
                  aria-controls="sheet-you"
                  onClick={() => setOpen((o) => (o === 'you' ? null : 'you'))}
                  className={clsx('flex items-center gap-2 py-1.5 pl-2.5 pr-2 border transition-colors duration-fast', open === 'you' || current === 'you' ? 'border-border-default' : 'border-transparent hover:border-border-subtle')}
                  aria-label={tier ? `You: rating ${Math.round(user.elo_rating)}, ${tier.name}. Open menu` : 'Open menu'}
                >
                  {tier && (
                    <>
                      <span className="font-display font-black text-lg tabular text-text-primary leading-none">{Math.round(user.elo_rating)}</span>
                      <span className="w-1.5 h-1.5" style={{ background: tier.color }} aria-hidden="true" />
                    </>
                  )}
                  <span className="hidden sm:block text-[13px] text-text-secondary max-w-[9rem] truncate">{user.username}</span>
                  <ChevronDown size={12} strokeWidth={2} className={clsx('text-text-secondary transition-transform duration-fast', open === 'you' && 'rotate-180')} aria-hidden="true" />
                </button>
                <Sheet open={open === 'you'} id="sheet-you" align="right">
                  {tier && (
                    <div className="px-4 py-3 border-b-2 border-border-default flex items-end justify-between gap-3">
                      <div>
                        <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-text-secondary">Rating</span>
                        <span className="font-display font-black text-3xl tabular leading-none text-text-primary">{Math.round(user.elo_rating)}</span>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] pb-1" style={{ color: tier.color }}>
                        {tier.name}
                      </span>
                    </div>
                  )}
                  {youItems.map((d) => (
                    <DestRow key={d.href} d={d} active={pathname === d.href} onClick={() => setOpen(null)} />
                  ))}
                  <div className="px-4 py-3 border-t border-border-subtle flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Eye size={13} strokeWidth={1.75} aria-hidden="true" />
                      {mode === 'simple' ? 'Simple view' : 'All the numbers'}
                    </span>
                    <DetailToggle />
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-3 border-t-2 border-border-default text-sm text-text-secondary hover:text-text-primary hover:bg-bg-muted transition-colors duration-fast">
                    <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
                    Sign out
                  </button>
                </Sheet>
              </div>
            ) : (
              <>
                <Link href="/login" className="ink-link px-1 text-[13px] font-medium text-text-secondary hover:text-text-primary">
                  Sign in
                </Link>
                <Link href="/register" className="hidden sm:inline-flex items-center h-9 px-3 bg-accent text-accent-ink font-mono text-[11px] uppercase tracking-[0.14em] no-underline hover:shadow-ink hover:-translate-x-0.5 hover:-translate-y-0.5 transition-[transform,box-shadow] duration-fast">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Bottom tab bar — mobile */}
      {!isAdmin && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-bg-base border-t-2 border-border-default"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          aria-label="Main navigation"
        >
          <ul className="grid grid-cols-5" style={{ height: TABBAR_HEIGHT }}>
            {[
              { href: '/play', label: 'Play', icon: Gamepad2, key: 'play' as const },
              { href: '/learn', label: 'Learn', icon: GraduationCap, key: 'improve' as const },
              { href: '/lab', label: 'Lab', icon: FlaskConical, key: 'lab' as const },
              { href: '/leaderboard', label: 'Ranked', icon: Trophy, key: 'ranked' as const },
              { href: user ? profileHref : '/login', label: user ? 'You' : 'Sign in', icon: User, key: 'you' as const },
            ].map((t) => {
              const Icon = t.icon;
              const active = t.key === 'lab' ? pathname.startsWith('/lab') : t.key === 'improve' ? current === 'improve' && !pathname.startsWith('/lab') : current === t.key;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? 'page' : undefined}
                    className={clsx('relative h-full flex flex-col items-center justify-center gap-1 no-underline transition-colors duration-fast', active ? 'text-text-primary' : 'text-text-secondary')}
                  >
                    {active && <span className="absolute top-0 inset-x-3 h-0.5 bg-accent" aria-hidden="true" />}
                    <Icon size={20} strokeWidth={active ? 2 : 1.75} aria-hidden="true" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.12em]">{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
