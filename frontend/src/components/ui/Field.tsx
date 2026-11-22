import type { InputHTMLAttributes, ReactNode } from 'react';

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-mono text-[0.7rem] uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </span>
      <input
        {...props}
        className="w-full border border-line-strong bg-paper-raised px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-clay focus:outline-none"
      />
      {hint ? <span className="mt-1.5 block text-xs text-ink-soft">{hint}</span> : null}
    </label>
  );
}
