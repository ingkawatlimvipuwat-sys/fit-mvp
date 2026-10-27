import { fitProfileByKey } from '@/lib/config/fit-profiles';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import type { PresetOption } from '@/lib/fit/preset-options';

/**
 * The rule actually governing a garment right now, translated into an
 * editable FitRuleset to seed the override editor. Ticking the override
 * checkbox used to always open on DEFAULT_RULE regardless of what profile or
 * preset the garment was really using, so any dimension the retailer left
 * untouched would silently revert to the global default on save.
 *
 * `choice` must be the ruleChoice value from BEFORE any preset->profile
 * fallback reassignment happens in the checkbox handler, or a preset-backed
 * garment would never seed from its preset — only from the fallback profile.
 *
 * Returns null when `choice` is a preset whose rule is not in `presets`
 * (not loaded yet, or the load failed): the caller must refuse rather than
 * start from the default rule. Pass only the real loaded presets, never the
 * select's options, which may contain a dummy-rule placeholder.
 */
export function seedOverrideFrom(choice: string, presets: PresetOption[]): FitRuleset | null {
  let source: FitRuleset;
  if (choice.startsWith('preset:')) {
    const id = choice.slice('preset:'.length);
    const preset = presets.find(p => p.id === id);
    if (!preset) return null;
    source = preset.rule;
  } else {
    const key = choice.startsWith('profile:') ? choice.slice('profile:'.length) : choice;
    source = fitProfileByKey(key).ruleset;
  }
  // `regular`'s ruleset has no `base` by design (see the comment on
  // FitRuleset.base) — the editor still needs one to render, so fill it in
  // without mutating the source ruleset.
  return { base: source.base ?? DEFAULT_RULE, perDimension: source.perDimension };
}

/**
 * Whether ticking "custom rule" should seed the editor from the rule in force.
 * Not when the garment already had an override in force when the form opened
 * (that stored override is already in state), and not when the retailer has
 * edited the override this session (toggling off and on must keep their edits).
 */
export function shouldSeedOverride(on: boolean, hadOverrideInForce: boolean, editedThisSession: boolean): boolean {
  return on && !hadOverrideInForce && !editedThisSession;
}
