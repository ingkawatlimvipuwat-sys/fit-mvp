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
