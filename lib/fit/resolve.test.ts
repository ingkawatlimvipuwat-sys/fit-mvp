import { describe, it, expect } from 'vitest';
import { EaseRuleSchema, FitRulesetSchema, RulesetNameSchema } from './rule-schema';

describe('EaseRuleSchema', () => {
  it('accepts the default rule', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1, goodTo: 5 }).success).toBe(true);
  });
  it('accepts a stretchy rule with negative ease', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -6, goodFrom: -4, goodTo: 3 }).success).toBe(true);
  });
  it('accepts tightBelow === goodFrom (no snug zone)', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: 1, goodFrom: 1, goodTo: 5 }).success).toBe(true);
  });
  it('rejects goodFrom === goodTo — good_fit would be unreachable', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 3, goodTo: 3 }).success).toBe(false);
  });
  it('rejects tightBelow > goodFrom', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: 2, goodFrom: 1, goodTo: 5 }).success).toBe(false);
  });
  it('rejects a unit slip (500 for 50)', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1, goodTo: 500 }).success).toBe(false);
  });
  it('rejects a missing field', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1 }).success).toBe(false);
  });
  it('rejects a non-numeric field', () => {
    expect(EaseRuleSchema.safeParse({ tightBelow: -1, goodFrom: 1, goodTo: '5' }).success).toBe(false);
  });
});

describe('FitRulesetSchema', () => {
  it('accepts an empty ruleset and defaults perDimension', () => {
    const r = FitRulesetSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.perDimension).toEqual({});
  });
  it('accepts base plus a per-dimension exception', () => {
    const r = FitRulesetSchema.safeParse({
      base: { tightBelow: -1, goodFrom: 1, goodTo: 5 },
      perDimension: { waist_cm: { tightBelow: -6, goodFrom: -4, goodTo: 3 } },
    });
    expect(r.success).toBe(true);
  });
  it('rejects an unknown dimension key', () => {
    const r = FitRulesetSchema.safeParse({
      perDimension: { elbow_cm: { tightBelow: -1, goodFrom: 1, goodTo: 5 } },
    });
    expect(r.success).toBe(false);
  });
  it('rejects a ruleset whose nested rule is invalid', () => {
    const r = FitRulesetSchema.safeParse({
      perDimension: { chest_cm: { tightBelow: -1, goodFrom: 5, goodTo: 5 } },
    });
    expect(r.success).toBe(false);
  });
});

describe('RulesetNameSchema', () => {
  it('trims and accepts a normal name', () => {
    const r = RulesetNameSchema.safeParse('  ผ้ายืด  ');
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toBe('ผ้ายืด');
  });
  it('rejects an empty name', () => {
    expect(RulesetNameSchema.safeParse('   ').success).toBe(false);
  });
  it('rejects a name over 60 chars', () => {
    expect(RulesetNameSchema.safeParse('x'.repeat(61)).success).toBe(false);
  });
});

import { resolveRuleset, builtinRuleset, type GarmentRuleFields } from './resolve';
import { evaluateFit } from './engine';

const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };
const TAILORED = { tightBelow: 0, goodFrom: 1, goodTo: 3 };

const garment = (over: Partial<GarmentRuleFields> = {}): GarmentRuleFields => ({
  fit_profile: 'regular', fit_ruleset_id: null, fit_rule_override: null, ...over,
});

describe('builtinRuleset', () => {
  it('returns regular for an unrecognised profile key', () => {
    // moved here from engine.test.ts — the fallback is the resolver's job now
    expect(builtinRuleset('banana')).toEqual(builtinRuleset('regular'));
  });
  it('returns the slim ruleset for slim', () => {
    expect(builtinRuleset('slim').perDimension.chest_cm).toEqual({ tightBelow: -1, goodFrom: 1, goodTo: 3 });
  });
});

describe('resolveRuleset — precedence', () => {
  it('override beats preset', () => {
    const r = resolveRuleset(
      garment({ fit_rule_override: { perDimension: { chest_cm: STRETCHY } } }),
      { perDimension: { chest_cm: TAILORED } }
    );
    expect(r.perDimension.chest_cm).toEqual(STRETCHY);
  });
  it('preset beats built-in', () => {
    const r = resolveRuleset(garment({ fit_profile: 'slim' }), { perDimension: { chest_cm: STRETCHY } });
    expect(r.perDimension.chest_cm).toEqual(STRETCHY);
  });
  it('falls back to built-in when there is no override and no preset', () => {
    expect(resolveRuleset(garment({ fit_profile: 'slim' }), null)).toEqual(builtinRuleset('slim'));
  });
  it('override REPLACES the preset rather than merging with it', () => {
    const r = resolveRuleset(
      garment({ fit_rule_override: { perDimension: { chest_cm: STRETCHY } } }),
      { perDimension: { waist_cm: TAILORED } }
    );
    expect(r.perDimension.waist_cm).toBeUndefined();
  });
});

describe('resolveRuleset — malformed input never throws', () => {
  it('falls back to fit_profile when the override is malformed', () => {
    const r = resolveRuleset(garment({ fit_profile: 'slim', fit_rule_override: { nonsense: true } }), null);
    expect(r).toEqual(builtinRuleset('slim'));
  });
  it('falls back to fit_profile when the stored preset is malformed', () => {
    const r = resolveRuleset(garment({ fit_profile: 'relaxed' }), { perDimension: { chest_cm: { tightBelow: 9 } } });
    expect(r).toEqual(builtinRuleset('relaxed'));
  });
});

describe('the case this feature exists for', () => {
  it('a stretchy rule returns good_fit where the default returns too_tight', () => {
    // garment 97cm, customer 100cm -> ease -3.
    // NOT -4: ease exactly at goodFrom is snug per the verdict table, so a
    // garment measuring 96 would assert the wrong verdict. Pick a point
    // strictly inside the good_fit zone.
    const g = { chest_cm: 97 }, c = { chest_cm: 100 };
    expect(evaluateFit(g, c, builtinRuleset('regular')).dimensions.chest_cm?.verdict).toBe('too_tight');
    const stretchy = resolveRuleset(garment(), { base: STRETCHY, perDimension: {} });
    expect(evaluateFit(g, c, stretchy).dimensions.chest_cm?.verdict).toBe('good_fit');
  });
});

describe('boundaries land on the documented side', () => {
  const rule = { tightBelow: -1, goodFrom: 1, goodTo: 5 };
  const rs = { base: rule, perDimension: {} };
  const verdictAtEase = (ease: number) =>
    evaluateFit({ chest_cm: 100 }, { chest_cm: 100 - ease }, rs).dimensions.chest_cm?.verdict;

  it('ease exactly at tightBelow is too_tight', () => expect(verdictAtEase(-1)).toBe('too_tight'));
  it('ease just above tightBelow is snug',   () => expect(verdictAtEase(-0.5)).toBe('snug'));
  it('ease exactly at goodFrom is snug',     () => expect(verdictAtEase(1)).toBe('snug'));
  it('ease just above goodFrom is good_fit', () => expect(verdictAtEase(1.5)).toBe('good_fit'));
  it('ease exactly at goodTo is good_fit',   () => expect(verdictAtEase(5)).toBe('good_fit'));
  it('ease just above goodTo is loose',      () => expect(verdictAtEase(5.5)).toBe('loose'));
});

describe('empty snug zone', () => {
  it('never returns unknown when tightBelow === goodFrom', () => {
    const rs = { base: { tightBelow: 1, goodFrom: 1, goodTo: 5 }, perDimension: {} };
    for (const ease of [-5, -1, 0, 1, 2, 5, 9]) {
      const v = evaluateFit({ chest_cm: 100 }, { chest_cm: 100 - ease }, rs).dimensions.chest_cm?.verdict;
      expect(v).not.toBe('unknown');
      expect(v).not.toBe('snug');
    }
  });
});
