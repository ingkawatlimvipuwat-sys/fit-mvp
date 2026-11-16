import Link from 'next/link';
import type { ComponentProps } from 'react';

type Variant = 'primary' | 'secondary';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-dark border border-accent',
  secondary: 'bg-surface text-ink border border-ink hover:bg-page',
};

/** A link that looks like Button (for navigation that must stay a real <a>). */
export default function LinkButton({
  variant = 'primary', className = '', ...rest
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link
      className={`inline-flex min-h-[52px] items-center justify-center rounded-xl px-4 py-2 text-center text-base font-semibold sm:min-h-12 ${VARIANT[variant]} ${className}`}
      {...rest}
    />
  );
}
