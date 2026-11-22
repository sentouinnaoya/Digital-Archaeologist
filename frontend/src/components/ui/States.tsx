import type { ReactNode } from 'react';

export function Alert({
  children,
  tone = 'error',
}: {
  children: ReactNode;
  tone?: 'error' | 'info';
}) {
  const color =
    tone === 'error'
      ? 'border-alert/40 bg-alert/5 text-alert'
      : 'border-clay/30 bg-clay/5 text-clay-dark';
  return (
    <div className={`border px-4 py-3 text-sm ${color}`} role="status">
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-paper-sunken ${className}`} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-line-strong bg-paper-raised/60 px-6 py-12 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
        {description}
      </p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'active' | 'warning';
}) {
  const color =
    tone === 'active'
      ? 'border-moss/40 text-moss'
      : tone === 'warning'
        ? 'border-clay/40 text-clay-dark'
        : 'border-line-strong text-ink-soft';
  return (
    <span
      className={`inline-flex border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider ${color}`}
    >
      {children}
    </span>
  );
}
