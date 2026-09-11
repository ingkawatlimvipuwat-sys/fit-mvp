import { describe, it, expect } from 'vitest';
import {
  ColourSchema, ColoursSchema, FabricSchema,
  isFabricEmpty, chipStringKey, FABRIC_CHIPS,
  parseColoursField, parseFabricField,
} from './colour-fabric';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe('ColourSchema', () => {
  it('accepts a six-digit hex with a name', () => {
    expect(ColourSchema.safeParse({ hex: '#A1b2C3', name: 'กรมท่า' }).success).toBe(true);
  });

  it('rejects shorthand, missing hash, bad characters and wrong length', () => {
    for (const hex of ['#abc', 'abcdef', '#abcdeg', '#abcdef0', '']) {
      expect(ColourSchema.safeParse({ hex, name: 'x' }).success).toBe(false);
    }
  });

  it('trims the name and enforces 1..40', () => {
    const ok = ColourSchema.safeParse({ hex: '#000000', name: '  navy  ' });
    expect(ok.success && ok.data.name).toBe('navy');
    expect(ColourSchema.safeParse({ hex: '#000000', name: '   ' }).success).toBe(false);
    expect(ColourSchema.safeParse({ hex: '#000000', name: 'x'.repeat(40) }).success).toBe(true);
    expect(ColourSchema.safeParse({ hex: '#000000', name: 'x'.repeat(41) }).success).toBe(false);
  });

  it('REJECTS unknown keys rather than stripping them', () => {
    expect(ColourSchema.safeParse({ hex: '#000000', name: 'x', position: 2 }).success).toBe(false);
  });
});

describe('ColoursSchema', () => {
  it('accepts an empty list — empty is a meaningful value, not an error', () => {
    expect(ColoursSchema.safeParse([]).success).toBe(true);
  });

  it('accepts duplicates and imposes no ranking', () => {
    const r = ColoursSchema.safeParse([
      { hex: '#ff0000', name: 'red' },
      { hex: '#ff0000', name: 'red again' },
    ]);
    expect(r.success && r.data).toHaveLength(2);
  });

  it('rejects the whole list if any one entry is bad', () => {
    expect(ColoursSchema.safeParse([
      { hex: '#ff0000', name: 'red' },
      { hex: 'nope', name: 'bad' },
    ]).success).toBe(false);
  });
});

describe('FabricSchema', () => {
  it('parses to all-null when every key is omitted', () => {
    const r = FabricSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.finish).toBeNull();
  });

  it('turns blank strings into null, not empty strings', () => {
    const r = FabricSchema.safeParse({ finish: '', composition: '   ', weight_gsm: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.finish).toBeNull();
      expect(r.data.composition).toBeNull();
      expect(r.data.weight_gsm).toBeNull();
    }
  });

  it('accepts every documented enum value', () => {
    for (const [group, values] of Object.entries(FABRIC_CHIPS)) {
      for (const v of values) {
        expect(FabricSchema.safeParse({ [group]: v }).success).toBe(true);
      }
    }
  });

  it('rejects an enum value outside the set', () => {
    expect(FabricSchema.safeParse({ finish: 'shiny' }).success).toBe(false);
    expect(FabricSchema.safeParse({ stretch: 'stretchy' }).success).toBe(false);
  });

  it('coerces numeric strings and enforces the ranges the CHECKs enforce', () => {
    const r = FabricSchema.safeParse({ weight_gsm: '180', thread_count: '400', pore_size_mm: '0.25' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.weight_gsm).toBe(180);
      expect(r.data.pore_size_mm).toBe(0.25);
    }
    expect(FabricSchema.safeParse({ weight_gsm: 0 }).success).toBe(false);
    expect(FabricSchema.safeParse({ weight_gsm: 2001 }).success).toBe(false);
    expect(FabricSchema.safeParse({ weight_gsm: 12.5 }).success).toBe(false);
    expect(FabricSchema.safeParse({ pore_size_mm: 0 }).success).toBe(false);
    expect(FabricSchema.safeParse({ weight_gsm: 'heavy' }).success).toBe(false);
  });

  it('REJECTS unknown keys', () => {
    expect(FabricSchema.safeParse({ gsm: 180 }).success).toBe(false);
  });
});

describe('isFabricEmpty', () => {
  it('is true for null, undefined and an all-null row', () => {
    expect(isFabricEmpty(null)).toBe(true);
    expect(isFabricEmpty(undefined)).toBe(true);
    expect(isFabricEmpty({})).toBe(true);
  });

  it('is false as soon as any one content field is set', () => {
    expect(isFabricEmpty({ finish: 'matte' })).toBe(false);
    expect(isFabricEmpty({ notes: 'ผ้าฝ้ายญี่ปุ่น' })).toBe(false);
    expect(isFabricEmpty({ weight_gsm: 180 })).toBe(false);
    expect(isFabricEmpty({ pore_size_mm: 0.25 })).toBe(false);
  });

  it('ignores the columns that are not content', () => {
    expect(isFabricEmpty({
      garment_id: 'f0e1d2c3-0000-4000-8000-000000000000',
      updated_at: '2026-09-11T00:00:00Z',
      fabric_photo_url: 'https://example.test/a.jpg',
    })).toBe(true);
  });

  it('treats a blank string as unset', () => {
    expect(isFabricEmpty({ composition: '   ' })).toBe(true);
  });
});

describe('chipStringKey', () => {
  it('derives the i18n key from the group and value', () => {
    expect(chipStringKey('finish', 'matte')).toBe('finishMatte');
    expect(chipStringKey('finish', 'slight_sheen')).toBe('finishSlightSheen');
    expect(chipStringKey('thickness', 'thin')).toBe('thicknessThin');
    expect(chipStringKey('stretch', 'none')).toBe('stretchNone');
    expect(chipStringKey('feel', 'crisp')).toBe('feelCrisp');
  });
});

describe('parseColoursField', () => {
  it('reports present:false when the field is ABSENT', () => {
    expect(parseColoursField(fd({}))).toEqual({ ok: true, present: false });
  });

  it('reports present:true with [] when the field is "[]"', () => {
    const r = parseColoursField(fd({ colours: '[]' }));
    expect(r.ok && r.present).toBe(true);
    expect(r.ok && r.present && r.colours).toEqual([]);
  });

  it('parses a list', () => {
    const r = parseColoursField(fd({ colours: '[{"hex":"#112233","name":"navy"}]' }));
    expect(r.ok && r.present && r.colours).toEqual([{ hex: '#112233', name: 'navy' }]);
  });

  it('fails on malformed JSON, a bad entry, and a non-array', () => {
    expect(parseColoursField(fd({ colours: '{' })).ok).toBe(false);
    expect(parseColoursField(fd({ colours: '[{"hex":"x","name":"y"}]' })).ok).toBe(false);
    expect(parseColoursField(fd({ colours: '{"hex":"#112233","name":"navy"}' })).ok).toBe(false);
  });
});

describe('parseFabricField', () => {
  it('reports present:false when the field is ABSENT', () => {
    expect(parseFabricField(fd({}))).toEqual({ ok: true, present: false });
  });

  it('reports present:true for "{}" so an all-null save can clear the row', () => {
    const r = parseFabricField(fd({ fabric: '{}' }));
    expect(r.ok && r.present).toBe(true);
    expect(r.ok && r.present && isFabricEmpty(r.fabric)).toBe(true);
  });

  it('parses a populated fabric', () => {
    const r = parseFabricField(fd({ fabric: '{"finish":"matte","weight_gsm":"180"}' }));
    expect(r.ok && r.present && r.fabric.finish).toBe('matte');
    expect(r.ok && r.present && r.fabric.weight_gsm).toBe(180);
  });

  it('fails on malformed JSON and on a bad enum', () => {
    expect(parseFabricField(fd({ fabric: 'nope' })).ok).toBe(false);
    expect(parseFabricField(fd({ fabric: '{"feel":"silky"}' })).ok).toBe(false);
  });
});
