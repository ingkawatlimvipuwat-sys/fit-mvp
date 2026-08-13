import { describe, it, expect } from 'vitest';
import { parseGarmentFields } from './parse-form';

const UUID = '11111111-2222-4333-8444-555555555555';
const STRETCHY = { tightBelow: -6, goodFrom: -4, goodTo: 3 };

/** Minimal valid top, with any field overridden or removed (value `null`). */
function form(over: Record<string, string | null> = {}): FormData {
  const base: Record<string, string> = {
    name: 'เสื้อเชิ้ตลินิน', category: 'top', fit_profile: 'regular', chest_cm: '97',
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries({ ...base, ...over })) {
    if (v !== null) fd.set(k, v);
  }
  return fd;
}

describe('parseGarmentFields', () => {
  it('accepts a minimal valid garment', () => {
    const r = parseGarmentFields(form());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.name).toBe('เสื้อเชิ้ตลินิน');
    expect(r.data.category).toBe('top');
    expect(r.data.measurements).toEqual({ chest_cm: 97 });
    expect(r.data.fit_ruleset_id).toBeNull();
    expect(r.data.fit_rule_override).toBeNull();
  });

  it('trims the name and rejects a blank one', () => {
    expect(parseGarmentFields(form({ name: '  padded  ' })).ok).toBe(true);
    const r = parseGarmentFields(form({ name: '   ' }));
    expect(r).toEqual({ ok: false, error: 'name required' });
  });

  it('rejects an unknown category', () => {
    expect(parseGarmentFields(form({ category: 'hat' })).ok).toBe(false);
  });

  it('rejects an unknown fit profile', () => {
    expect(parseGarmentFields(form({ fit_profile: 'nonsense' })).ok).toBe(false);
  });

  it('keeps only measurements belonging to the category', () => {
    // hip_cm is a bottom/dress dimension; a top must not carry it.
    const r = parseGarmentFields(form({ hip_cm: '95' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.measurements).toEqual({ chest_cm: 97 });
  });

  it('requires at least one measurement', () => {
    expect(parseGarmentFields(form({ chest_cm: null })).ok).toBe(false);
  });

  it.each(['0', '-5', '301', 'abc'])('rejects the out-of-range measurement %s', v => {
    expect(parseGarmentFields(form({ chest_cm: v })).ok).toBe(false);
  });

  it('accepts a valid preset id', () => {
    const r = parseGarmentFields(form({ fit_ruleset_id: UUID }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fit_ruleset_id).toBe(UUID);
  });

  it('rejects a preset id that is not a uuid', () => {
    expect(parseGarmentFields(form({ fit_ruleset_id: 'not-a-uuid' })).ok).toBe(false);
  });

  it('lets an override clear the preset — the two are mutually exclusive', () => {
    const r = parseGarmentFields(form({
      fit_ruleset_id: UUID,
      fit_rule_override: JSON.stringify({ base: STRETCHY, perDimension: {} }),
    }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fit_rule_override?.base).toEqual(STRETCHY);
    expect(r.data.fit_ruleset_id).toBeNull();
  });

  it('treats an absent override as "no override", so editing can turn one off', () => {
    const r = parseGarmentFields(form({ fit_ruleset_id: UUID, fit_rule_override: '' }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.fit_rule_override).toBeNull();
    expect(r.data.fit_ruleset_id).toBe(UUID);
  });

  it('rejects an override that is not JSON', () => {
    expect(parseGarmentFields(form({ fit_rule_override: '{oops' })).ok).toBe(false);
  });

  it('REJECTS an override with unknown keys rather than stripping them', () => {
    // Without .strict() zod strips unknown keys, so this would parse
    // "successfully" as an empty ruleset and silently drop every dimension to
    // its default — a wrong verdict, not an error. See /CLAUDE.md.
    expect(parseGarmentFields(form({ fit_rule_override: '{"nonsense":true}' })).ok).toBe(false);
  });

  it('rejects an override whose bounds are inverted', () => {
    const bad = JSON.stringify({ base: { tightBelow: 5, goodFrom: 1, goodTo: 3 }, perDimension: {} });
    expect(parseGarmentFields(form({ fit_rule_override: bad })).ok).toBe(false);
  });
});
