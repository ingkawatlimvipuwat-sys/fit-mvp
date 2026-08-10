import { describe, it, expect } from 'vitest';
import { easeRuleToBands, DEFAULT_RULE, type EaseRule } from './rules';

const INF = Number.POSITIVE_INFINITY;

/** Frozen copy of DEFAULT_BANDS as it stood at commit e3cd406. Golden value. */
const LEGACY_DEFAULT_BANDS = [
  { min: 1,    max: INF,  verdict: 'too_tight' },
  { min: -1,   max: 1,    verdict: 'snug' },
  { min: -5,   max: -1,   verdict: 'good_fit' },
  { min: -INF, max: -5,   verdict: 'loose' },
];

/** Frozen copies of SLIM_DEFAULT / RELAXED_DEFAULT at the same commit. */
const LEGACY_SLIM_BANDS = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -3,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -3,  verdict: 'loose' },
];
const LEGACY_RELAXED_BANDS = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -8,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -8,  verdict: 'loose' },
];

describe('easeRuleToBands — regression guard', () => {
  it('DEFAULT_RULE compiles to the legacy default bands exactly', () => {
    expect(easeRuleToBands(DEFAULT_RULE)).toEqual(LEGACY_DEFAULT_BANDS);
  });
  it('slim rule compiles to the legacy slim bands exactly', () => {
    expect(easeRuleToBands({ tightBelow: -1, goodFrom: 1, goodTo: 3 })).toEqual(LEGACY_SLIM_BANDS);
  });
  it('relaxed rule compiles to the legacy relaxed bands exactly', () => {
    expect(easeRuleToBands({ tightBelow: -1, goodFrom: 1, goodTo: 8 })).toEqual(LEGACY_RELAXED_BANDS);
  });
});

describe('easeRuleToBands — structure', () => {
  it('covers the whole number line with no gaps', () => {
    const bands = easeRuleToBands({ tightBelow: -6, goodFrom: -4, goodTo: 3 });
    expect(bands[0].max).toBe(INF);
    expect(bands[bands.length - 1].min).toBe(-INF);
    // each band's min meets the previous band's max
    for (let i = 1; i < bands.length; i++) {
      expect(bands[i].max).toBe(bands[i - 1].min);
    }
  });

  it('produces an empty snug band when tightBelow === goodFrom', () => {
    const bands = easeRuleToBands({ tightBelow: 1, goodFrom: 1, goodTo: 5 });
    const snug = bands.find(b => b.verdict === 'snug')!;
    expect(snug.min).toBe(snug.max); // min === max never matches [min, max)
  });
});
