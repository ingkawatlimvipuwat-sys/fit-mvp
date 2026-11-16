import { describe, expect, it } from 'vitest';
import { easeBar } from '@/lib/fit/ease-bar';
import { DEFAULT_RULE } from '@/lib/fit/rules';

describe('easeBar', () => {
  it('zones add up to the whole bar', () => {
    const b = easeBar(3, DEFAULT_RULE);
    expect(b.tight + b.snug + b.good + b.loose).toBeCloseTo(100);
  });

  it('gives the default rule its true proportions (snug 2 cm, good 4 cm)', () => {
    const b = easeBar(3, DEFAULT_RULE);
    expect(b.good / b.snug).toBeCloseTo(2);
    expect(b.tight).toBeCloseTo(b.loose);
  });

  it('puts the dot inside the good zone for garment 103 / customer 100 (ease 3)', () => {
    const b = easeBar(3, DEFAULT_RULE);
    expect(b.dot).toBeGreaterThan(b.tight + b.snug);
    expect(b.dot).toBeLessThan(b.tight + b.snug + b.good);
  });

  it('puts the dot exactly on the zone edges at the rule boundaries', () => {
    const r = DEFAULT_RULE;
    expect(easeBar(r.tightBelow, r).dot).toBeCloseTo(easeBar(0, r).tight);
    const atGoodFrom = easeBar(r.goodFrom, r);
    expect(atGoodFrom.dot).toBeCloseTo(atGoodFrom.tight + atGoodFrom.snug);
    const atGoodTo = easeBar(r.goodTo, r);
    expect(atGoodTo.dot).toBeCloseTo(atGoodTo.tight + atGoodTo.snug + atGoodTo.good);
  });

  it('moves right as the garment gets roomier', () => {
    const dots = [-2, 0, 2, 4, 6].map(e => easeBar(e, DEFAULT_RULE).dot);
    expect([...dots].sort((a, b) => a - b)).toEqual(dots);
  });

  it('clamps a far-off ease so the dot stays on the bar', () => {
    expect(easeBar(-40, DEFAULT_RULE).dot).toBe(3);
    expect(easeBar(40, DEFAULT_RULE).dot).toBe(97);
  });

  it('draws no snug zone when tightBelow equals goodFrom', () => {
    const b = easeBar(0, { tightBelow: 0, goodFrom: 0, goodTo: 4 });
    expect(b.snug).toBe(0);
    expect(b.good).toBeGreaterThan(0);
  });

  it('follows a stretchy rule with negative ease', () => {
    const stretchy = { tightBelow: -6, goodFrom: -4, goodTo: 0 };
    const b = easeBar(-2, stretchy);
    expect(b.dot).toBeGreaterThan(b.tight + b.snug);
    expect(b.dot).toBeLessThan(b.tight + b.snug + b.good);
  });
});
