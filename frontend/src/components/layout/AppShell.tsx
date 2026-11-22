'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Folder, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearCredentials } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/store/api/authApi';
import type { ReactNode } from 'react';

const primaryNav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Folder },
];

const plannedNav = [
  { label: 'Timeline', phase: 'Phase 3' },
  { label: 'Architecture', phase: 'Phase 6' },
  { label: 'Dependencies', phase: 'Phase 5' },
  { label: 'Comparison', phase: 'Phase 7' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [logout, { isLoading }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } finally {
      dispatch(clearCredentials());
    }
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-line bg-paper-raised lg:min-h-screen lg:border-r lg:border-b-0">
        <div className="border-b border-line px-6 py-6">
          <Link href="/" className="block">
            <span className="eyebrow">Software archaeology</span>
            <span className="mt-1 block font-display text-lg leading-tight text-ink">
              Digital Archaeologist
            </span>
          </Link>
          <p className="mt-3 font-mono text-[0.65rem] text-ink-faint">FIELD RECORD / 0.1.0</p>
        </div>

        <nav className="px-3 py-5">
          <p className="px-3 pb-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
            Workspace
          </p>
          {primaryNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`mb-1 flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                  active
                    ? 'bg-paper-sunken text-ink'
                    : 'text-ink-soft hover:bg-paper-sunken/60 hover:text-ink'
                }`}
              >
                <Icon size={16} strokeWidth={1.6} />
                {label}
              </Link>
            );
          })}

          <p className="mt-7 px-3 pb-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
            Planned instruments
          </p>
          {plannedNav.map((item) => (
            <div
              key={item.label}
              title={`${item.label} is scheduled for ${item.phase}`}
              className="mb-1 flex items-center justify-between px-3 py-2 text-sm text-ink-faint"
            >
              <span>{item.label}</span>
              <span className="font-mono text-[0.6rem]">{item.phase}</span>
            </div>
          ))}
        </nav>

        <div className="border-t border-line px-6 py-5">
          <p className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-faint">
            Signed in as
          </p>
          <p className="mt-1 truncate text-sm text-ink">{user?.fullName}</p>
          <p className="truncate font-mono text-[0.7rem] text-ink-soft">{user?.email}</p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void handleLogout()}
              disabled={isLoading}
              className="flex-1 px-2 py-1.5 text-xs"
            >
              <LogOut size={14} /> Sign out
            </Button>
            <span
              title="Settings is scheduled for Phase 9"
              className="inline-flex items-center gap-1 border border-line px-2 py-1.5 text-xs text-ink-faint"
            >
              <Settings size={14} /> Settings
            </span>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-9 lg:px-12">{children}</main>
    </div>
  );
}
