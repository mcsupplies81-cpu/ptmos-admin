'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/users', label: 'Users', icon: '🧑‍💼' },
  { href: '/providers', label: 'Providers', icon: '🏥' },
  { href: '/announcements', label: 'Announcements', icon: '📣' },
];

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-text">
      <aside className="fixed inset-y-0 left-0 w-[240px] border-r border-border bg-sidebar px-4 py-6">
        <div className="mb-8 px-3 text-xl font-black tracking-tight text-accent">PT-OS Admin</div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

            return (
              <Link
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  isActive
                    ? 'border border-accent/40 bg-accent text-text shadow-lg shadow-accent/10'
                    : 'text-text-secondary hover:bg-card hover:text-text'
                }`}
                href={item.href}
                key={item.href}
              >
                <span aria-hidden="true" className="text-lg">
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ml-[240px] min-h-screen bg-background p-8">{children}</main>
    </div>
  );
}
