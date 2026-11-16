import type { ButtonHTMLAttributes } from 'react';

type Tone = 'link' | 'danger';

const TONE: Record<Tone, string> = {
  link: 'text-accent hover:text-accent-dark',
  danger: 'text-verdict-tight-fg hover:underline',
};

/** A quiet 44px text button: accent for ordinary actions, dark orange for destructive ones. */
export default function TextButton({
  tone = 'link', className = '', type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-[44px] items-center px-2 text-sm font-medium underline-offset-2 disabled:opacity-60 ${TONE[tone]} ${tone === 'link' ? 'hover:underline' : ''} ${className}`}
      {...rest}
    />
  );
}
