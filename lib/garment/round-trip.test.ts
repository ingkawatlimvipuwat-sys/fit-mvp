import { describe, it, expect } from 'vitest';
import { ruleSelectionForGarment } from '@/lib/fit/rule-selection';
import { buildGarmentFields } from './form-fields';
import { parseGarmentFields } from './parse-form';
import type { Category } from '@/lib/supabase/types';

const UUID = '11111111-2222-4333-8444-555555555555';
const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };

/**
 * The feature's core claim: a garment's stored rule columns survive a trip
 * through the edit form unchanged.
 *
 * Each hop is unit-tested on its own elsewhere. This closes the loop, which
 * matters more than usual here — the Supabase clients are untyped, so a
 * column-name slip compiles clean and only fails in front of a customer.
 */
const CASES = [
  {
    name: 'built-in profile',
    fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: null,
  },
  {
    name: 'shop preset',
    fit_profile: 'slim', fit_ruleset_id: UUID, fit_rule_override: null,
  },
  {
    name: 'inline override',
    fit_profile: 'relaxed', fit_ruleset_id: null,
    fit_rule_override: { base: STRETCHY, perDimension: {} },
  },
];

describe('stored rule columns round-trip through the edit form', () => {
  it.each(CASES)('$name survives unchanged', stored => {
    const selection = ruleSelectionForGarment(stored);

    const fields = buildGarmentFields({
      name: 'เสื้อเชิ้ตลินิน',
      category: 'top' as Category,
      measurements: { chest_cm: '97' },
      ruleChoice: selection.ruleChoice,
      useOverride: selection.useOverride,
      override: selection.override,
      fallbackProfile: selection.profileKey,
    });

    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);

    const parsed = parseGarmentFields(form);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.data.fit_profile).toBe(stored.fit_profile);
    expect(parsed.data.fit_ruleset_id).toBe(stored.fit_ruleset_id);
    expect(parsed.data.fit_rule_override).toEqual(stored.fit_rule_override);
    expect(parsed.data.measurements).toEqual({ chest_cm: 97 });
  });
});
