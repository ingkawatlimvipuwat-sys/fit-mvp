import { describe, it, expect, vi } from 'vitest';
import { ruleSelectionForGarment } from './rule-selection';
import { DEFAULT_RULE } from './rules';

const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };
const UUID = '11111111-2222-3333-4444-555555555555';

describe('ruleSelectionForGarment', () => {
  it('shows the built-in profile when there is no preset and no override', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: null,
    });
    expect(sel).toEqual({
      useOverride: false,
      override: { base: DEFAULT_RULE, perDimension: {} },
      ruleChoice: 'profile:slim',
      profileKey: 'slim',
    });
  });

  it('shows the preset when one is attached', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular', fit_ruleset_id: UUID, fit_rule_override: null,
    });
    expect(sel.useOverride).toBe(false);
    expect(sel.ruleChoice).toBe(`preset:${UUID}`);
    expect(sel.profileKey).toBe('regular');
  });

  it('a garment on a preset keeps its own profile as profileKey, not the preset', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'slim', fit_ruleset_id: UUID, fit_rule_override: null,
    });
    expect(sel.ruleChoice).toBe(`preset:${UUID}`);
    expect(sel.profileKey).toBe('slim');
  });

  it('an override wins over a preset, matching resolveRuleset precedence', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular',
      fit_ruleset_id: UUID,
      fit_rule_override: { base: STRETCHY, perDimension: {} },
    });
    expect(sel.useOverride).toBe(true);
    expect(sel.override.base).toEqual(STRETCHY);
  });

  it('leaves the select on the profile while an override is active, so unticking falls back sanely', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'relaxed',
      fit_ruleset_id: null,
      fit_rule_override: { base: STRETCHY, perDimension: {} },
    });
    expect(sel.ruleChoice).toBe('profile:relaxed');
  });

  it('falls back to regular for an unrecognised profile key', () => {
    const sel = ruleSelectionForGarment({
      fit_profile: 'nonsense', fit_ruleset_id: null, fit_rule_override: null,
    });
    expect(sel.ruleChoice).toBe('profile:regular');
    expect(sel.profileKey).toBe('regular');
  });

  it('ignores a malformed override and falls through to the preset', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular',
      fit_ruleset_id: UUID,
      fit_rule_override: { nonsense: true },
    });
    expect(sel.useOverride).toBe(false);
    expect(sel.ruleChoice).toBe(`preset:${UUID}`);
    spy.mockRestore();
  });

  it('ignores a malformed override and falls through to the profile when there is no preset', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sel = ruleSelectionForGarment({
      fit_profile: 'slim', fit_ruleset_id: null, fit_rule_override: { goodFrom: 'x' },
    });
    expect(sel.useOverride).toBe(false);
    expect(sel.ruleChoice).toBe('profile:slim');
    spy.mockRestore();
  });

  it('treats a deleted preset (null id) as no preset', () => {
    // fit_ruleset_id is `on delete set null`, so a deleted preset is already
    // null in the row and customers are already scored under the profile.
    const sel = ruleSelectionForGarment({
      fit_profile: 'regular', fit_ruleset_id: null, fit_rule_override: null,
    });
    expect(sel.ruleChoice).toBe('profile:regular');
  });
});
