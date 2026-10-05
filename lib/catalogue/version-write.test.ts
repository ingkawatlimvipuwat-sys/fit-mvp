import { describe, it, expect } from 'vitest';
import { checkPicksForWrite } from './version-write';
import { t } from '@/lib/i18n/strings';

const pickers = [{ id: 's', name: 'Size', position: 0 }, { id: 'c', name: 'Colour', position: 1 }];
const ver = (id: string, picks: Record<string, string>) => ({ id, picks, created_at: '2026-01-01T00:00:00Z' });
const ctx = (versions = [ver('a', { s: 'L', c: 'Black' })], p = pickers) => ({ pickers: p, versions });

describe('checkPicksForWrite', () => {
  it('accepts a complete, unique combination', () => {
    expect(checkPicksForWrite(ctx(), { s: 'L', c: 'Green' })).toEqual({ ok: true });
  });
  it('requires every picker when the product has pickers', () => {
    expect(checkPicksForWrite(ctx(), { s: 'M' })).toEqual({ ok: false, error: t.pickRequired.th });
  });
  it('rejects a duplicate (trim, case-insensitive), naming the existing version', () => {
    expect(checkPicksForWrite(ctx(), { s: ' l ', c: 'BLACK' })).toEqual({
      ok: false, error: t.duplicatePicks.th.replace('{label}', 'L / Black'),
    });
  });
  it('lets a version keep its own picks when edited', () => {
    expect(checkPicksForWrite(ctx(), { s: 'L', c: 'Black' }, 'a')).toEqual({ ok: true });
  });
  it('a product with no pickers may hold one version only', () => {
    expect(checkPicksForWrite(ctx([ver('a', {})], []), {})).toEqual({ ok: false, error: t.addPickersFirst.th });
    expect(checkPicksForWrite(ctx([], []), {})).toEqual({ ok: true });
    expect(checkPicksForWrite(ctx([ver('a', {})], []), {}, 'a')).toEqual({ ok: true });
  });
});
