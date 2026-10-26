import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';

export type PresetOption = { id: string; name: string; rule: FitRuleset };
export type PresetsStatus = 'loading' | 'ready' | 'failed';
/** A select option; `placeholder` marks a stand-in for a preset not in the loaded list. */
export type PresetSelectOption = PresetOption & { placeholder?: 'loading' | 'unavailable' };

/**
 * The shop-rule options for the garment form's select. When the garment's own
 * preset is not in the loaded list, a stand-in keeps the select showing the
 * garment's real rule: 'loading' while the fetch is in flight, 'unavailable'
 * once it has failed or finished without it. A stand-in is display-only and
 * must never be used as a seed source (its rule is a dummy).
 */
export function presetOptionsFor(
  presets: PresetOption[],
  initialChoice: string | undefined,
  status: PresetsStatus,
): PresetSelectOption[] {
  const list: PresetSelectOption[] = [...presets];
  if (initialChoice?.startsWith('preset:')) {
    const id = initialChoice.slice('preset:'.length);
    if (!list.some(p => p.id === id)) {
      list.unshift({
        id,
        name: '',
        rule: { base: DEFAULT_RULE, perDimension: {} },
        placeholder: status === 'loading' ? 'loading' : 'unavailable',
      });
    }
  }
  return list;
}
