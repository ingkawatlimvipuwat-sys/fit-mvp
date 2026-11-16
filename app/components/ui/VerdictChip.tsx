import type { Verdict } from '@/lib/fit/engine';

export const VERDICT_CHIP: Record<Verdict, string> = {
  too_tight: 'bg-verdict-tight-bg text-verdict-tight-fg',
  snug: 'bg-verdict-snug-bg text-verdict-snug-fg',
  good_fit: 'bg-verdict-good-bg text-verdict-good-fg',
  loose: 'bg-verdict-loose-bg text-verdict-loose-fg',
  unknown: 'border border-dashed border-field bg-surface text-verdict-unknown-fg',
};

/** Always carries the verdict word, so colour is never the only signal. */
export default function VerdictChip({ verdict, label, className = '' }: {
  verdict: Verdict; label: string; className?: string;
}) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-[3px] text-[13px] font-semibold ${VERDICT_CHIP[verdict]} ${className}`}>
      {label}
    </span>
  );
}

/** Text colour alone, for large headings that already sit on a white card. */
export const VERDICT_TEXT: Record<Verdict, string> = {
  too_tight: 'text-verdict-tight-fg',
  snug: 'text-verdict-snug-fg',
  good_fit: 'text-verdict-good-fg',
  loose: 'text-verdict-loose-fg',
  unknown: 'text-verdict-unknown-fg',
};
