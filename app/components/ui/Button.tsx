import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-dark border border-accent h-[52px] sm:h-12',
  secondary: 'bg-surface text-ink border border-ink hover:bg-page h-[52px] sm:h-12',
  ghost: 'bg-transparent text-accent hover:text-accent-dark border border-transparent min-h-[44px] underline-offset-2 hover:underline',
};

export default function Button({
  variant = 'primary', fullWidth = false, className = '', type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; fullWidth?: boolean }) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-xl px-4 text-base font-semibold disabled:opacity-60 ${VARIANT[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  );
}
