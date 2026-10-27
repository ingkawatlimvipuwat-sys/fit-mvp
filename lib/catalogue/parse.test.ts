import { describe, it, expect } from 'vitest';
import { parseProductName, parsePickerName, parsePicksField, parseFolderName, parseTagName } from './parse';
import { t } from '@/lib/i18n/strings';

describe('names', () => {
  it('trims', () => { expect(parseProductName('  Tee ')).toEqual({ ok: true, value: 'Tee' }); });
  it('rejects blank and too long', () => {
    expect(parseProductName('')).toEqual({ ok: false, error: t.invalidProductName.th });
    expect(parsePickerName('')).toEqual({ ok: false, error: t.invalidPickerName.th });
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

describe('parseFolderName', () => {
  it('trims', () => { expect(parseFolderName('  Shirts ')).toEqual({ ok: true, value: 'Shirts' }); });
  it('accepts 60 characters, rejects blank and 61 with the Thai message', () => {
    expect(parseFolderName('x'.repeat(60)).ok).toBe(true);
    expect(parseFolderName('   ')).toEqual({ ok: false, error: t.invalidFolderName.th });
    expect(parseFolderName('x'.repeat(61)).ok).toBe(false);
  });
});

describe('parseTagName', () => {
  it('trims; 1–30 characters; Thai message', () => {
    expect(parseTagName(' Sale ')).toEqual({ ok: true, value: 'Sale' });
    expect(parseTagName('x'.repeat(30)).ok).toBe(true);
    expect(parseTagName('x'.repeat(31))).toEqual({ ok: false, error: t.invalidTagName.th });
    expect(parseTagName('').ok).toBe(false);
  });
});
