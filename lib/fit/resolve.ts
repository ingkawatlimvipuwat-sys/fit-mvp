import { fitProfileByKey } from '@/lib/config/fit-profiles';
import { FitRulesetSchema } from './rule-schema';
import type { FitRuleset } from './rules';

/** The subset of a garment row that rule resolution needs. */
export interface GarmentRuleFields {
  fit_profile: string;
  fit_ruleset_id?: string | null;
  fit_rule_override?: unknown;
}

/** Built-in profile as a ruleset. Unrecognised keys resolve to `regular`. */
export function builtinRuleset(fitProfileKey: string): FitRuleset {
  return fitProfileByKey(fitProfileKey).ruleset;
}

/**
 * Resolve the ruleset actually in force for a garment.
 *
 *     override ?? preset ?? builtinProfile(fit_profile)
 *
 * All-or-nothing at the ruleset level: an override REPLACES the preset, it does
 * not merge with it. Merging would make "which number is in force" unanswerable
 * from any one place.
 *
 * Pure — the caller fetches `presetRule` and passes it in, so this does no I/O.
 *
 * A malformed stored rule must never break the customer-facing checker, so both
 * inputs are validated and a failure logs and falls through to the built-in.
 */
export function resolveRuleset(garment: GarmentRuleFields, presetRule: unknown): FitRuleset {
  if (garment.fit_rule_override != null) {
    const parsed = FitRulesetSchema.safeParse(garment.fit_rule_override);
    if (parsed.success) return parsed.data;
    console.error('malformed fit_rule_override; falling back to fit_profile');
  }

  if (presetRule != null) {
    const parsed = FitRulesetSchema.safeParse(presetRule);
    if (parsed.success) return parsed.data;
    console.error('malformed fit_ruleset.rule; falling back to fit_profile');
  }

  return builtinRuleset(garment.fit_profile);
}
