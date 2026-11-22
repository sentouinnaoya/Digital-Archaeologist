'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAppSelector } from '@/store/hooks';
import { AppShell } from './AppShell';

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { hydrated, accessToken } = useAppSelector((state) => state.auth);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !accessToken) {
      router.replace('/login');
    }
  }, [hydrated, accessToken, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-soft">
          Restoring field notes…
        </p>
      </div>
    );
  }

  if (!accessToken) return null;

  return <AppShell>{children}</AppShell>;
}
