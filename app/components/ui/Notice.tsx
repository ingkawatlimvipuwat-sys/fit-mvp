import type { HTMLAttributes } from 'react';

type Tone = 'error' | 'warn';

const TONE: Record<Tone, string> = {
  error: 'bg-verdict-tight-bg text-verdict-tight-fg',
  warn: 'bg-verdict-snug-bg text-verdict-snug-fg',
};

/** An inline error / warning box. Keeps its text and position; only the look is shared. */
export default function Notice({
  tone = 'error', className = '', ...rest
}: HTMLAttributes<HTMLParagraphElement> & { tone?: Tone }) {
  return <p className={`rounded-[10px] px-3 py-2.5 text-sm font-medium ${TONE[tone]} ${className}`} {...rest} />;
}
