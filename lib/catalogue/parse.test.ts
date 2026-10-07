import { describe, it, expect } from 'vitest';
import { parseProductName, parsePickerName, parsePicksField } from './parse';

describe('names', () => {
  it('trims', () => { expect(parseProductName('  Tee ')).toEqual({ ok: true, value: 'Tee' }); });
  it('rejects blank and too long', () => {
    expect(parseProductName('  ').ok).toBe(false);
    expect(parseProductName('x'.repeat(121)).ok).toBe(false);
    expect(parsePickerName('x'.repeat(31)).ok).toBe(false);
    expect(parsePickerName('Size')).toEqual({ ok: true, value: 'Size' });
  });
});

describe('parsePicksField', () => {
  const ids = ['p1', 'p2'];
  it('empty is {}', () => { expect(parsePicksField('', ids)).toEqual({ ok: true, picks: {} }); });
  it('accepts known keys and trims values', () => {
    expect(parsePicksField('{"p1":" L ","p2":"Black"}', ids)).toEqual({ ok: true, picks: { p1: 'L', p2: 'Black' } });
  });
  it("rejects an unknown picker id (another shop's picker looks like this)", () => {
    expect(parsePicksField('{"zzz":"L"}', ids).ok).toBe(false);
  });
  it('rejects bad shapes', () => {
    for (const bad of ['not json', '[]', '{"p1":5}', JSON.stringify({ p1: 'x'.repeat(61) })]) {
      expect(parsePicksField(bad, ids).ok).toBe(false);
    }
  });
});
