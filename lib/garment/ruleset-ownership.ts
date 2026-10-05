import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';

export type OwnershipResult =
  | { ok: true }
  | { ok: false; status: 400 | 500; error: string };

/**
 * A garment may only point at a preset its own shop owns. parseGarmentFields()
 * checks the id is well-formed but is pure and cannot see the database, so the
 * routes call this after it. Scoping the read by retailer_id makes another
 * shop's preset indistinguishable from a nonexistent one. A failed lookup is
 * a 500, never a pass: silently accepting an unverified id is the bug.
 */
export async function checkRulesetOwnership(
  supabase: SupabaseClient,
  userId: string,
  rulesetId: string | null,
): Promise<OwnershipResult> {
  if (rulesetId === null) return { ok: true };

  const { data, error } = await supabase
    .from('fit_rulesets')
    .select('id')
    .eq('id', rulesetId)
    .eq('retailer_id', userId)
    .maybeSingle();

  if (error) {
    console.error('ruleset ownership lookup failed:', error);
    return { ok: false, status: 500, error: t.saveFailed.th };
  }
  if (!data) return { ok: false, status: 400, error: t.rulesetNotOwned.th };
  return { ok: true };
}
