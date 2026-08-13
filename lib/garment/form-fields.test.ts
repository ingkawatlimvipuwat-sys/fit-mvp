import { describe, it, expect } from 'vitest';
import { activeMeasurements, strandedDimensions, buildGarmentFields } from './form-fields';
import { parseGarmentFields } from './parse-form';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { GarmentFormState } from './form-fields';

const UUID = '11111111-2222-4333-8444-555555555555';
const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };

function baseState(over: Partial<GarmentFormState> = {}): GarmentFormState {
  return {
    name: 'เสื้อเชิ้ตลินิน',
    category: 'top',
    ruleChoice: 'profile:regular',
    useOverride: false,
    override: { base: DEFAULT_RULE, perDimension: {} },
    measurements: { chest_cm: '97' },
    ...over,
  };
}

describe('activeMeasurements', () => {
  it('returns only the dimensions belonging to the category, trimmed', () => {
    const result = activeMeasurements(
      { chest_cm: ' 97 ', hip_cm: '95', waist_cm: '' },
      'top',
    );
    // hip_cm is bottom/dress only; waist_cm is present but blank.
    expect(result).toEqual([['chest_cm', '97']]);
  });

  it('skips whitespace-only values', () => {
    const result = activeMeasurements({ chest_cm: '   ' }, 'top');
    expect(result).toEqual([]);
  });
});

describe('strandedDimensions', () => {
  it('returns [] when nothing is stranded', () => {
    expect(strandedDimensions({ chest_cm: '97' }, 'top')).toEqual([]);
  });

  it('flags a value left behind after switching category', () => {
    // chest_cm has no input under 'bottom'.
    expect(strandedDimensions({ chest_cm: '97' }, 'bottom')).toEqual(['chest_cm']);
  });

  it('ignores empty values, so a blank hidden field never triggers a warning', () => {
    expect(strandedDimensions({ chest_cm: '' }, 'bottom')).toEqual([]);
    expect(strandedDimensions({ chest_cm: '   ' }, 'bottom')).toEqual([]);
  });
});

describe('buildGarmentFields', () => {
  it('a plain profile choice writes fit_profile and nothing else rule-related', () => {
    const fields = buildGarmentFields(baseState({ ruleChoice: 'profile:slim', useOverride: false }));
    expect(fields.fit_profile).toBe('slim');
    expect(fields.fit_ruleset_id).toBeUndefined();
    expect(fields.fit_rule_override).toBeUndefined();
  });

  it('a preset choice writes fit_profile as the regular fallback plus fit_ruleset_id', () => {
    const fields = buildGarmentFields(baseState({ ruleChoice: `preset:${UUID}`, useOverride: false }));
    expect(fields.fit_profile).toBe('regular');
    expect(fields.fit_ruleset_id).toBe(UUID);
    expect(fields.fit_rule_override).toBeUndefined();
  });

  it('REGRESSION: an override does not clobber the profile the retailer picked', () => {
    const fields = buildGarmentFields(baseState({
      ruleChoice: 'profile:slim',
      useOverride: true,
      override: { base: STRETCHY, perDimension: {} },
    }));
    expect(fields.fit_profile).toBe('slim');
    expect(fields.fit_rule_override).toBe(JSON.stringify({ base: STRETCHY, perDimension: {} }));
  });

  it('an override clears a preset — fit_ruleset_id is absent', () => {
    const fields = buildGarmentFields(baseState({
      ruleChoice: `preset:${UUID}`,
      useOverride: true,
      override: { base: STRETCHY, perDimension: {} },
    }));
    expect(fields.fit_rule_override).toBe(JSON.stringify({ base: STRETCHY, perDimension: {} }));
    expect(fields.fit_ruleset_id).toBeUndefined();
  });

  it('trims the name', () => {
    const fields = buildGarmentFields(baseState({ name: '  padded  ' }));
    expect(fields.name).toBe('padded');
  });

  it('round-trips through FormData and parseGarmentFields', () => {
    const state = baseState({
      name: 'ยีนส์ขากระบอก',
      category: 'bottom',
      ruleChoice: 'profile:relaxed',
      useOverride: false,
      measurements: { waist_cm: '80', hip_cm: '96' },
    });
    const fields = buildGarmentFields(state);

    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);

    const parsed = parseGarmentFields(form);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.name).toBe('ยีนส์ขากระบอก');
    expect(parsed.data.category).toBe('bottom');
    expect(parsed.data.fit_profile).toBe('relaxed');
    expect(parsed.data.fit_ruleset_id).toBeNull();
    expect(parsed.data.fit_rule_override).toBeNull();
    expect(parsed.data.measurements).toEqual({ waist_cm: 80, hip_cm: 96 });
  });

  it('round-trips an override through FormData and parseGarmentFields', () => {
    const state = baseState({
      ruleChoice: 'profile:slim',
      useOverride: true,
      override: { base: STRETCHY, perDimension: {} },
    });
    const fields = buildGarmentFields(state);

    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.set(k, v);

    const parsed = parseGarmentFields(form);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.data.fit_profile).toBe('slim');
    expect(parsed.data.fit_rule_override?.base).toEqual(STRETCHY);
    expect(parsed.data.fit_ruleset_id).toBeNull();
  });
});
