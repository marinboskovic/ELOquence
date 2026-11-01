'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', exact: true },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/games', label: 'Games' },
  { href: '/admin/words', label: 'Words' },
  { href: '/admin/announcements', label: 'Announcements' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/health', label: 'Health' },
];

/**
 * Underline tab strip for the admin area: a hair rule along the bottom,
 * mono labels, the current tab underlined in accent (the one accent on the
 * strip — same rule as the main nav).
 */
export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="mb-10 md:mb-12 border-b border-border-subtle overflow-x-auto hide-native-scrollbar" aria-label="Admin navigation">
      <ul className="flex items-stretch gap-6 -mb-px min-w-max">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={clsx(
                  'block py-3 font-mono text-label uppercase whitespace-nowrap border-b-2 transition-colors duration-fast',
                  isActive
                    ? 'text-text-primary border-accent'
                    : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-default'
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
