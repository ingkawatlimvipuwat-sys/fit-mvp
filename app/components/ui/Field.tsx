import type { InputHTMLAttributes } from 'react';

/** Label + number/text input with an optional unit inside the box + a hint line. */
export default function Field({
  label, hint, unit, className = '', ...rest
}: { label: string; hint?: string; unit?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="relative mt-1 block">
        <input
          className={`block h-12 w-full rounded-[10px] border border-field bg-surface px-3 text-base text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${unit ? 'pr-12' : ''}`}
          {...rest}
        />
        {unit && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted">
            {unit}
          </span>
        )}
      </span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}
