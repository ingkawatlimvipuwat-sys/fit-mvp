import { describe, it, expect } from 'vitest';
import { evaluateFit } from './engine';

describe('evaluateFit — per-dimension bands (regular profile)', () => {
  // Per spec §7: customer vs garment
  //  > +1cm  -> too_tight
  //  ±1cm    -> snug
  //  1-5 cm smaller -> good_fit
  //  > 5cm smaller -> loose
  it('too_tight when customer > garment + 1', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 102 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('too_tight');
  });
  it('snug when customer within ±1', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 100 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('snug');
  });
  it('good_fit when customer is 1-5cm smaller', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 97 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('good_fit');
  });
  it('loose when customer is >5cm smaller', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 90 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('loose');
  });
});

describe('evaluateFit — fit profile shifts the bands', () => {
  it('slim tightens good_fit (acceptable ease shrinks to 0..3)', () => {
    // garment 100, customer 96 → diff -4 → still good_fit on regular,
    // but loose on slim (slim good_fit band is -3..-1).
    const regular = evaluateFit({ chest_cm: 100 }, { chest_cm: 96 }, 'regular');
    const slim    = evaluateFit({ chest_cm: 100 }, { chest_cm: 96 }, 'slim');
    expect(regular.dimensions.chest_cm?.verdict).toBe('good_fit');
    expect(slim.dimensions.chest_cm?.verdict).toBe('loose');
  });
  it('relaxed widens good_fit (acceptable ease extends to 1..8)', () => {
    // garment 100, customer 93 → diff -7 → loose on regular, good_fit on relaxed.
    const regular = evaluateFit({ chest_cm: 100 }, { chest_cm: 93 }, 'regular');
    const relaxed = evaluateFit({ chest_cm: 100 }, { chest_cm: 93 }, 'relaxed');
    expect(regular.dimensions.chest_cm?.verdict).toBe('loose');
    expect(relaxed.dimensions.chest_cm?.verdict).toBe('good_fit');
  });
});

describe('evaluateFit — missing values', () => {
  it('marks unknown when garment lacks the dimension', () => {
    const r = evaluateFit({}, { chest_cm: 95 }, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('unknown');
  });
  it('marks unknown when customer lacks the dimension', () => {
    const r = evaluateFit({ chest_cm: 100 }, {}, 'regular');
    expect(r.dimensions.chest_cm?.verdict).toBe('unknown');
  });
});

describe('evaluateFit — overall verdict (worst wins)', () => {
  it('overall = too_tight if any dimension is too_tight', () => {
    const r = evaluateFit(
      { chest_cm: 100, waist_cm: 80 },
      { chest_cm: 102, waist_cm: 78 }, // chest too tight, waist good
      'regular'
    );
    expect(r.overall).toBe('too_tight');
  });
  it('overall ignores unknown dimensions', () => {
    const r = evaluateFit(
      { chest_cm: 100 },
      { chest_cm: 97, waist_cm: 70 }, // only chest scored (good_fit)
      'regular'
    );
    expect(r.overall).toBe('good_fit');
  });
  it('overall = unknown when no dimension can be scored', () => {
    const r = evaluateFit({}, {}, 'regular');
    expect(r.overall).toBe('unknown');
  });
});

describe('evaluateFit — unknown fit profile falls back to regular', () => {
  it('falls back when given a nonexistent profile key', () => {
    const r = evaluateFit({ chest_cm: 100 }, { chest_cm: 97 }, 'banana');
    expect(r.dimensions.chest_cm?.verdict).toBe('good_fit');
  });
});
