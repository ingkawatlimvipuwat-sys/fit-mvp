import type { Verdict } from '@/lib/fit/engine';

export type IssueVerdict = Exclude<Verdict, 'good_fit' | 'unknown'>;

export interface FitSummary {
  /** Dimensions whose verdict is not `unknown`. */
  scored: number;
  /** Scored dimensions that are `good_fit`. */
  good: number;
  /** The other scored dimensions, grouped by verdict, most severe first. */
  issues: { verdict: IssueVerdict; keys: string[] }[];
}

const ISSUE_ORDER: IssueVerdict[] = ['too_tight', 'snug', 'loose'];

/**
 * Pure counting over a fit result, no judgement added. `order` fixes the order
 * of keys within a group (the product's dimension order); without it the
 * result's own key order is used.
 */
export function summariseFit(
  result: { dimensions: Record<string, { verdict: Verdict } | undefined> },
  order?: readonly string[],
): FitSummary {
  const keys = order ?? Object.keys(result.dimensions);
  let scored = 0;
  let good = 0;
  const groups: Record<IssueVerdict, string[]> = { too_tight: [], snug: [], loose: [] };
  for (const key of keys) {
    const v = result.dimensions[key]?.verdict;
    if (!v || v === 'unknown') continue;
    scored++;
    if (v === 'good_fit') good++;
    else groups[v].push(key);
  }
  return {
    scored,
    good,
    issues: ISSUE_ORDER.filter(v => groups[v].length > 0).map(v => ({ verdict: v, keys: groups[v] })),
  };
}
