import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-paper-raised border-ink hover:bg-clay hover:border-clay',
  secondary:
    'bg-paper-raised text-ink border-line-strong hover:border-ink',
  ghost: 'bg-transparent text-ink-soft border-transparent hover:text-ink hover:bg-paper-sunken',
  danger: 'bg-transparent text-alert border-line-strong hover:border-alert',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  );
}
