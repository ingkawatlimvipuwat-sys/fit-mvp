import { describe, it, expect } from 'vitest';
import { SIZE_LABELS, isSizeLabel, displaySizeLabel } from './size-label';
import { parseGarmentFields } from './parse-form';
import { buildGarmentFields } from './form-fields';
import { DEFAULT_RULE } from '@/lib/fit/rules';

function baseForm(extra: Record<string, string> = {}) {
  const f = new FormData();
  f.set('name', 'Tee'); f.set('category', 'top'); f.set('chest_cm', '100');
  for (const [k, v] of Object.entries(extra)) f.set(k, v);
  return f;
}

describe('size label validation', () => {
  it('is null when absent or blank', () => {
    for (const f of [baseForm(), baseForm({ size_label: '' }), baseForm({ size_label: '  ' })]) {
      const r = parseGarmentFields(f);
      expect(r.ok && r.data.size_label).toBe(null);
    }
  });

  it.each(SIZE_LABELS)('accepts %s', code => {
    const r = parseGarmentFields(baseForm({ size_label: code }));
    expect(r.ok && r.data.size_label).toBe(code);
  });

  it.each(['xl', 'XXXL', 'Free size', 'M; drop table'])('rejects %s', bad => {
    expect(parseGarmentFields(baseForm({ size_label: bad })).ok).toBe(false);
  });
});

describe('size label display', () => {
  it('shows nothing for empty or unknown', () => {
    expect(displaySizeLabel(null, 'en')).toBe(null);
    expect(displaySizeLabel('', 'th')).toBe(null);
    expect(displaySizeLabel('bogus', 'en')).toBe(null);
  });
  it('shows letters as-is and FREE in the chosen language', () => {
    expect(displaySizeLabel('M', 'th')).toBe('M');
    expect(displaySizeLabel('FREE', 'en')).toBe('Free size');
    expect(displaySizeLabel('FREE', 'th')).toBe('ฟรีไซส์');
    expect(isSizeLabel('XS')).toBe(true);
  });
});

describe('form state round-trip', () => {
  const state = {
    name: 'Tee', category: 'top' as const, ruleChoice: 'profile:regular', useOverride: false,
    override: { base: DEFAULT_RULE, perDimension: {} }, measurements: { chest_cm: '100' },
    fallbackProfile: 'regular',
  };
  it('carries a chosen size through to the parser', () => {
    const f = new FormData();
    for (const [k, v] of Object.entries(buildGarmentFields({ ...state, sizeLabel: 'L' }))) f.set(k, v);
    const r = parseGarmentFields(f);
    expect(r.ok && r.data.size_label).toBe('L');
  });
  it('an empty choice sends nothing, which clears it on edit', () => {
    expect(buildGarmentFields({ ...state, sizeLabel: '' })).not.toHaveProperty('size_label');
  });
});
