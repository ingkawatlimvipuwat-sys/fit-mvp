import type { TextareaHTMLAttributes } from 'react';

/** Label + textarea, drawn like Field. */
export default function Textarea({
  label, className = '', ...rest
}: { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="text-sm font-semibold text-ink">{label}</span>
      <textarea
        className="mt-1 block w-full rounded-[10px] border border-field bg-surface px-3 py-2.5 text-base text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        {...rest}
      />
    </label>
  );
}
