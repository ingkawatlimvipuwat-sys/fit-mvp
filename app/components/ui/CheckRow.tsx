import type { InputHTMLAttributes } from 'react';

/** A 44px-tall checkbox or radio row. The caller passes type, name, checked, onChange as usual. */
export default function CheckRow({
  children, className = '', ...rest
}: { children: React.ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>) {
  return (
    <label className={`inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-ink ${className}`}>
      <input className="h-5 w-5 shrink-0 accent-accent" {...rest} />
      <span className="min-w-0">{children}</span>
    </label>
  );
}
