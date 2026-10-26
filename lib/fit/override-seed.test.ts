import { describe, it, expect } from 'vitest';
import { seedOverrideFrom, shouldSeedOverride } from './override-seed';
import { ruleSelectionForGarment } from './rule-selection';
import { DEFAULT_RULE } from './rules';
import type { FitRuleset } from './rules';
import { fitProfileByKey } from '@/lib/config/fit-profiles';

const STRETCHY_RULESET: FitRuleset = { base: { tightBelow: -6, goodFrom: -4, goodTo: 3 }, perDimension: {} };

describe('seedOverrideFrom', () => {
  it('seeds a slim garment from slim, not from the default rule', () => {
    const slim = fitProfileByKey('slim').ruleset;
    const seed = seedOverrideFrom('profile:slim', []);
    expect(seed).toEqual({ base: slim.base ?? DEFAULT_RULE, perDimension: slim.perDimension });
    expect(seed).not.toEqual({ base: DEFAULT_RULE, perDimension: {} });
  });

  it('seeds regular with the default base', () => {
    expect(seedOverrideFrom('profile:regular', [])?.base).toEqual(DEFAULT_RULE);
  });

  it('accepts a bare legacy profile key', () => {
    const relaxed = fitProfileByKey('relaxed').ruleset;
    expect(seedOverrideFrom('relaxed', [])).toEqual({
      base: relaxed.base ?? DEFAULT_RULE, perDimension: relaxed.perDimension,
    });
  });

  it('seeds from a loaded shop rule', () => {
    const seed = seedOverrideFrom('preset:A', [{ id: 'A', name: 'x', rule: STRETCHY_RULESET }]);
    expect(seed).toEqual({ base: STRETCHY_RULESET.base, perDimension: {} });
  });

  it('fills a missing base with the default without mutating the source', () => {
    const rule: FitRuleset = { perDimension: {} };
    const seed = seedOverrideFrom('preset:A', [{ id: 'A', name: 'x', rule }]);
    expect(seed?.base).toEqual(DEFAULT_RULE);
    expect(rule).toEqual({ perDimension: {} });
  });

  it('returns null, never the default rule, when the preset is not loaded', () => {
    expect(seedOverrideFrom('preset:A', [])).toBeNull();
  });
});

describe('shouldSeedOverride', () => {
  it('seeds only when ticking on, no override was in force at open, and nothing edited yet', () => {
    expect(shouldSeedOverride(true, false, false)).toBe(true);
    expect(shouldSeedOverride(true, true, false)).toBe(false);
    expect(shouldSeedOverride(true, false, true)).toBe(false);
    expect(shouldSeedOverride(false, false, false)).toBe(false);
  });

  it('REGRESSION: an existing slim garment with no override still seeds', () => {
    // ruleSelectionForGarment always returns a non-null `override`, so the old
    // condition (`!initial.override`) was false here and the seed never ran.
    const sel = ruleSelectionForGarment({ fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: null });
    expect(sel.override).toBeTruthy();
    expect(shouldSeedOverride(true, sel.useOverride, false)).toBe(true);
  });
});
