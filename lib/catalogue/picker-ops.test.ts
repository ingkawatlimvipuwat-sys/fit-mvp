import { describe, it, expect } from 'vitest';
import { nextPosition, parseBackfill, planAddPicker } from './picker-ops';
import { t } from '@/lib/i18n/strings';

const ver = (id: string, picks: Record<string, string>) => ({ id, picks, created_at: '2026-01-01T00:00:00Z' });

describe('nextPosition', () => {
  it('is 0 for none and max+1 otherwise', () => {
    expect(nextPosition([])).toBe(0);
    expect(nextPosition([{ id: 'a', name: 'x', position: 0 }, { id: 'b', name: 'y', position: 4 }])).toBe(5);
  });
});

describe('parseBackfill', () => {
  it('accepts known version ids, trims, drops blanks', () => {
    expect(parseBackfill({ v1: ' L ', v2: '  ' }, ['v1', 'v2'])).toEqual({ ok: true, values: { v1: 'L' } });
  });
  it('treats absent as empty', () => {
    expect(parseBackfill(undefined, ['v1'])).toEqual({ ok: true, values: {} });
  });
  it("rejects another product's version id, non-strings and long values", () => {
    expect(parseBackfill({ zzz: 'L' }, ['v1']).ok).toBe(false);
    expect(parseBackfill({ v1: 5 }, ['v1']).ok).toBe(false);
    expect(parseBackfill({ v1: 'x'.repeat(61) }, ['v1']).ok).toBe(false);
    expect(parseBackfill([], ['v1']).ok).toBe(false);
  });
});

describe('planAddPicker', () => {
  const pickers = [{ id: 's', name: 'Size', position: 0 }];
  it('adds the new key only to versions given a value', () => {
    const r = planAddPicker({ pickers, versions: [ver('a', { s: 'L' }), ver('b', { s: 'M' })] }, 'n', { a: 'Long' });
    expect(r).toEqual({ ok: true, updates: [{ id: 'a', picks: { s: 'L', n: 'Long' } }] });
  });
  it('refuses when two versions would end up identical', () => {
    const r = planAddPicker(
      { pickers, versions: [ver('a', { s: 'L' }), ver('b', { s: 'L' })] }, 'n', { a: 'Long', b: ' long ' });
    expect(r).toEqual({ ok: false, error: t.duplicatePicks.th.replace('{label}', 'L / long') });
  });
});
