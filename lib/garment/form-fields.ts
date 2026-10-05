import { dimensionsForCategory } from '@/lib/config/dimensions';
import type { FitRuleset } from '@/lib/fit/rules';
import type { Category } from '@/lib/supabase/types';

/** The garment form's editable state, independent of React. */
export interface GarmentFormState {
  name: string;
  category: Category;
  /** Tagged rule choice: `profile:<key>` or `preset:<uuid>`. */
  ruleChoice: string;
  useOverride: boolean;
  override: FitRuleset;
  /** Keyed across ALL dimensions, values as typed (strings). */
  measurements: Record<string, string>;
  /**
   * What to store in fit_profile when the retailer has chosen a preset
   * instead. On create there is no prior choice, so 'regular'. On edit it is
   * the garment's existing profile — a preset outranks it now, but it is the
   * fallback if that preset is deleted, so overwriting it loses a real choice.
   */
  fallbackProfile: string;
  /** A SizeLabel code, or '' for none. */
  sizeLabel?: string;
}

/** Non-empty measurements belonging to `category`, as [key, value] pairs. */
export function activeMeasurements(
  measurements: Record<string, string>,
  category: Category,
): [string, string][] {
  return dimensionsForCategory(category)
    .map(d => [d.key, (measurements[d.key] ?? '').trim()] as [string, string])
    .filter(([, v]) => v !== '');
}

/**
 * Measurements the retailer has entered that `category` has no input for, so
 * saving would discard them. Drives the confirmation in the form.
 */
export function strandedDimensions(
  measurements: Record<string, string>,
  category: Category,
): string[] {
  const active = new Set<string>(dimensionsForCategory(category).map(d => d.key));
  return Object.keys(measurements)
    .filter(k => !active.has(k) && (measurements[k] ?? '').trim() !== '');
}

/**
 * Form state to the flat field set the API parses. The inverse of
 * parseGarmentFields() — a round-trip test pins the two together.
 *
 * fit_profile is always written because the column is NOT NULL, but note it is
 * not always what is in force: an override or a preset outranks it at resolve
 * time. It is the fallback the garment lands on if the override is switched
 * off or the preset is deleted, which is why a retailer's chosen profile must
 * survive being stored alongside an override.
 */
export function buildGarmentFields(s: GarmentFormState): Record<string, string> {
  const out: Record<string, string> = {
    name: s.name.trim(),
    category: s.category,
    fit_profile: s.ruleChoice.startsWith('profile:')
      ? s.ruleChoice.slice('profile:'.length)
      : s.fallbackProfile,
  };

  if (s.sizeLabel) out.size_label = s.sizeLabel;

  for (const [k, v] of activeMeasurements(s.measurements, s.category)) out[k] = v;

  // Mutually exclusive, and in this order: an override always clears a preset.
  if (s.useOverride) {
    out.fit_rule_override = JSON.stringify(s.override);
  } else if (s.ruleChoice.startsWith('preset:')) {
    out.fit_ruleset_id = s.ruleChoice.slice('preset:'.length);
  }

  return out;
}
