import { describe, it, expect } from 'vitest';
import { summariseFit } from './summary';
import type { Verdict } from './engine';

function res(v: Record<string, Verdict>) {
  const dimensions: Record<string, { verdict: Verdict }> = {};
  for (const [k, verdict] of Object.entries(v)) dimensions[k] = { verdict };
  return { dimensions };
}

describe('summariseFit', () => {
  it('counts nothing for an empty result', () => {
    expect(summariseFit(res({}))).toEqual({ scored: 0, good: 0, issues: [] });
  });

  it('all good', () => {
    expect(summariseFit(res({ chest_cm: 'good_fit', waist_cm: 'good_fit' })))
      .toEqual({ scored: 2, good: 2, issues: [] });
  });

  it('ignores unknown dimensions', () => {
    expect(summariseFit(res({ chest_cm: 'good_fit', waist_cm: 'unknown' })))
      .toEqual({ scored: 1, good: 1, issues: [] });
  });

  it('only unknown means nothing scored', () => {
    expect(summariseFit(res({ chest_cm: 'unknown' }))).toEqual({ scored: 0, good: 0, issues: [] });
  });

  it('groups issues by severity, too_tight then snug then loose', () => {
    const s = summariseFit(res({
      a: 'loose', b: 'snug', c: 'good_fit', d: 'too_tight', e: 'snug', f: 'unknown',
    }));
    expect(s.scored).toBe(5);
    expect(s.good).toBe(1);
    expect(s.issues).toEqual([
      { verdict: 'too_tight', keys: ['d'] },
      { verdict: 'snug', keys: ['b', 'e'] },
      { verdict: 'loose', keys: ['a'] },
    ]);
  });

  it('keeps keys in the given order when one is passed', () => {
    const s = summariseFit(res({ b: 'snug', a: 'snug' }), ['a', 'b']);
    expect(s.issues).toEqual([{ verdict: 'snug', keys: ['a', 'b'] }]);
  });

  it('skips keys missing from the result when an order is passed', () => {
    const s = summariseFit(res({ a: 'good_fit' }), ['a', 'zzz']);
    expect(s).toEqual({ scored: 1, good: 1, issues: [] });
  });
});
