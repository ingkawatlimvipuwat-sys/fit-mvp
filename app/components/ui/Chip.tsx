import type { ButtonHTMLAttributes } from 'react';

/** A 44px choice button (size, colour, profile). Selected = ink fill. */
export default function Chip({
  selected = false, className = '', type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`inline-flex h-11 min-w-[44px] items-center justify-center rounded-[10px] border px-3.5 text-base ${
        selected
          ? 'border-2 border-ink bg-ink font-semibold text-white'
          : 'border-control bg-surface font-medium text-ink hover:bg-page'
      } ${className}`}
      {...rest}
    />
  );
}
