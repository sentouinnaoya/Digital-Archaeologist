import type { ReactNode } from 'react';
import { ProtectedLayout } from '@/components/layout/ProtectedLayout';

export default function AppAreaLayout({ children }: { children: ReactNode }) {
  return <ProtectedLayout>{children}</ProtectedLayout>;
}
