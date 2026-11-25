import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Providers } from '@/components/Providers';
import '@xyflow/react/dist/style.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Digital Archaeologist',
    template: '%s · Digital Archaeologist',
  },
  description:
    'Reconstruct, analyse and explain the historical evolution of software projects from observable evidence.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
