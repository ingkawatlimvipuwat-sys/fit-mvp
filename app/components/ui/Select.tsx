import type { SelectHTMLAttributes } from 'react';

/** Label + select, drawn like Field: 48px tall, field border, accent focus ring. */
export default function Select({
  label, hint, className = '', children, ...rest
}: { label: string; hint?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <select
        className="mt-1 block h-12 w-full rounded-[10px] border border-field bg-surface px-3 text-base text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-60"
        {...rest}
      >
        {children}
      </select>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
