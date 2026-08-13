import { z } from 'zod';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { FitRulesetSchema, firstIssueMessage } from '@/lib/fit/rule-schema';
import { t } from '@/lib/i18n/strings';
import type { FitRuleset } from '@/lib/fit/rules';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

const CATEGORY = z.enum(['top', 'bottom', 'dress']);
const PROFILE_KEYS = FIT_PROFILES.map(p => p.key) as [string, ...string[]];

/** Exactly the columns a retailer may write. Never id/retailer_id/created_at. */
export interface GarmentFields {
  name: string;
  category: Category;
  fit_profile: string;
  fit_ruleset_id: string | null;
  fit_rule_override: FitRuleset | null;
  measurements: MeasurementBag;
}

export type ParseResult =
  | { ok: true; data: GarmentFields }
  | { ok: false; error: string };

/**
 * The single definition of "a valid garment", shared by POST (create) and
 * PATCH (edit) so the two cannot drift apart.
 *
 * Photo handling is deliberately NOT here: it is required on create, optional
 * on edit, and needs Storage I/O. Keeping it out leaves this function pure and
 * unit-testable, which is the only automated coverage the routes get.
 */
export function parseGarmentFields(form: FormData): ParseResult {
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { ok: false, error: 'name required' };

  const catParse = CATEGORY.safeParse(String(form.get('category') ?? ''));
  if (!catParse.success) return { ok: false, error: 'invalid category' };
  const category: Category = catParse.data;

  const fit_profile = String(form.get('fit_profile') ?? 'regular');
  if (!z.enum(PROFILE_KEYS).safeParse(fit_profile).success) {
    return { ok: false, error: 'invalid fit_profile' };
  }

  // These two are mutually exclusive by construction, not just by convention:
  // an inline override always clears any preset reference. On edit, an absent
  // override is also how an override gets turned OFF.
  let fit_rule_override: FitRuleset | null = null;
  let fit_ruleset_id: string | null = null;

  const overrideRaw = String(form.get('fit_rule_override') ?? '').trim();
  const rulesetIdRaw = String(form.get('fit_ruleset_id') ?? '').trim();

  if (overrideRaw) {
    let overrideJson: unknown;
    try { overrideJson = JSON.parse(overrideRaw); }
    catch { return { ok: false, error: 'ข้อมูลกฎไม่ถูกต้อง' }; }
    const parsed = FitRulesetSchema.safeParse(overrideJson);
    if (!parsed.success) return { ok: false, error: firstIssueMessage(parsed.error) };
    fit_rule_override = parsed.data;
  } else if (rulesetIdRaw) {
    if (!z.uuid().safeParse(rulesetIdRaw).success) {
      return { ok: false, error: 'invalid fit_ruleset_id' };
    }
    fit_ruleset_id = rulesetIdRaw;
  }

  // Collect measurements only for dimensions this category uses.
  const measurements: MeasurementBag = {};
  for (const d of dimensionsForCategory(category)) {
    const raw = form.get(d.key);
    if (raw === null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 300) {
      return { ok: false, error: `ค่าไม่ถูกต้อง: ${d.labelTh}` };
    }
    measurements[d.key] = num;
  }
  if (Object.keys(measurements).length === 0) {
    return { ok: false, error: t.garmentNeedsMeasurement.th };
  }

  return {
    ok: true,
    data: { name, category, fit_profile, fit_ruleset_id, fit_rule_override, measurements },
  };
}
