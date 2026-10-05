import { dimensionsForCategory } from '@/lib/config/dimensions';
import { isComplete, type Picks } from './picks';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export type AttentionReason = 'no_versions' | 'missing_measurement' | 'missing_pick';

/** Spec §5.5: why a product is flagged ⚠, each reason at most once. Empty = fine. */
export function attentionReasons(
  versions: { category: Category; measurements: MeasurementBag; picks: Picks }[],
  pickerIds: string[],
): AttentionReason[] {
  if (versions.length === 0) return ['no_versions'];
  const out = new Set<AttentionReason>();
  for (const v of versions) {
    const bag = (v.measurements ?? {}) as Record<string, number | undefined>;
    if (dimensionsForCategory(v.category).some(d => typeof bag[d.key] !== 'number')) out.add('missing_measurement');
    if (!isComplete(v.picks ?? {}, pickerIds)) out.add('missing_pick');
  }
  return [...out];
}
