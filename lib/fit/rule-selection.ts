import { fitProfileByKey } from '@/lib/config/fit-profiles';
import { FitRulesetSchema } from './rule-schema';
import { DEFAULT_RULE } from './rules';
import type { FitRuleset } from './rules';
import type { GarmentRuleFields } from './resolve';

/**
 * What the garment form's rule controls should show for an existing garment.
 * `select` is the grouped <select> value; `override` seeds FitRuleEditor.
 */
export interface RuleSelection {
  useOverride: boolean;
  override: FitRuleset;
  select: string;
}

/** Seed for the editor when the garment has no override of its own. */
const blankOverride = (): FitRuleset => ({ base: DEFAULT_RULE, perDimension: {} });

/**
 * Invert the stored rule columns back into form state.
 *
 * Precedence mirrors resolveRuleset() exactly — override, then preset, then
 * built-in profile — so the form always displays the rule the engine is
 * actually applying. If these two ever disagree, a retailer edits one rule
 * while customers are scored under another and nothing fails loudly.
 *
 * A malformed stored override is ignored here for the same reason
 * resolveRuleset ignores it: the form must not offer to "keep" a rule that is
 * not in force. Pure — no I/O, so the caller does not need the preset's rule,
 * only its id.
 */
export function ruleSelectionForGarment(g: GarmentRuleFields): RuleSelection {
  const selectProfile = `profile:${fitProfileByKey(g.fit_profile).key}`;

  if (g.fit_rule_override != null) {
    const parsed = FitRulesetSchema.safeParse(g.fit_rule_override);
    if (parsed.success) {
      return { useOverride: true, override: parsed.data, select: selectProfile };
    }
    console.error('malformed fit_rule_override; showing fit_profile instead');
  }

  if (g.fit_ruleset_id) {
    return { useOverride: false, override: blankOverride(), select: `preset:${g.fit_ruleset_id}` };
  }

  return { useOverride: false, override: blankOverride(), select: selectProfile };
}
