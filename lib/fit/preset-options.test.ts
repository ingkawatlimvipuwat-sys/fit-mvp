import { describe, it, expect } from 'vitest';
import { presetOptionsFor } from './preset-options';
import type { PresetOption } from './preset-options';
import { DEFAULT_RULE } from '@/lib/fit/rules';

const RULE = { base: { tightBelow: -6, goodFrom: -4, goodTo: 3 }, perDimension: {} };
const A: PresetOption = { id: 'A', name: 'Stretchy', rule: RULE };
const B: PresetOption = { id: 'B', name: 'Boxy', rule: RULE };

describe('presetOptionsFor', () => {
  it('adds a loading stand-in while the garment preset is not in the list yet', () => {
    const out = presetOptionsFor([], 'preset:A', 'loading');
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('A');
    expect(out[0].placeholder).toBe('loading');
    expect(out[0].rule).toEqual({ base: DEFAULT_RULE, perDimension: {} });
  });

  it('marks the stand-in unavailable once the load failed', () => {
    expect(presetOptionsFor([], 'preset:A', 'failed')[0].placeholder).toBe('unavailable');
  });

  it('marks the stand-in unavailable when the load finished without it', () => {
    expect(presetOptionsFor([B], 'preset:A', 'ready')[0]).toMatchObject({ id: 'A', placeholder: 'unavailable' });
  });

  it('leaves the list alone when the garment preset is loaded', () => {
    const list = [A, B];
    const out = presetOptionsFor(list, 'preset:A', 'ready');
    expect(out).toEqual(list);
    expect(out.some(o => o.placeholder)).toBe(false);
  });

  it('leaves the list alone for a built-in profile or no choice', () => {
    expect(presetOptionsFor([A], 'profile:slim', 'loading')).toEqual([A]);
    expect(presetOptionsFor([A], undefined, 'failed')).toEqual([A]);
  });

  it('does not mutate its input', () => {
    const list = [B];
    const copy = [...list];
    presetOptionsFor(list, 'preset:A', 'failed');
    expect(list).toEqual(copy);
  });
});
