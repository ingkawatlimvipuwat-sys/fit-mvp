import { describe, it, expect } from 'vitest';
import {
  showColourTab, showFabricTab, visibleChips, technicalRows, dotsWithOverflow,
} from './colour-fabric-view';
import type { GarmentFabric } from '@/lib/supabase/types';

const C = (hex: string, name: string) => ({ hex, name });

function fabric(over: Partial<GarmentFabric> = {}): GarmentFabric {
  return {
    garment_id: 'g', finish: null, thickness: null, stretch: null, feel: null,
    composition: null, weight_gsm: null, construction: null, thread_count: null,
    pore_size_mm: null, notes: null, fabric_photo_url: null,
    updated_at: '2026-09-11T00:00:00Z', ...over,
  };
}

describe('showColourTab', () => {
  it('is false with no colours and no photo', () => {
    expect(showColourTab([], null)).toBe(false);
  });
  it('is true with colours, or with only a true-colour photo', () => {
    expect(showColourTab([C('#000000', 'black')], null)).toBe(true);
    expect(showColourTab([], 'https://example.test/a.jpg')).toBe(true);
  });
});

describe('showFabricTab', () => {
  it('is false with no row at all', () => {
    expect(showFabricTab(null)).toBe(false);
  });
  it('is false for a row that exists but says nothing', () => {
    expect(showFabricTab(fabric())).toBe(false);
  });
  it('is true for one chip, one technical field, or only a photo', () => {
    expect(showFabricTab(fabric({ finish: 'matte' }))).toBe(true);
    expect(showFabricTab(fabric({ composition: 'cotton 100%' }))).toBe(true);
    expect(showFabricTab(fabric({ fabric_photo_url: 'https://example.test/f.jpg' }))).toBe(true);
  });
});

describe('visibleChips', () => {
  it('returns nothing for null or an all-null row', () => {
    expect(visibleChips(null)).toEqual([]);
    expect(visibleChips(fabric())).toEqual([]);
  });

  it('returns only the groups that are set', () => {
    expect(visibleChips(fabric({ finish: 'matte', feel: 'soft' })))
      .toEqual([{ group: 'finish', value: 'matte' }, { group: 'feel', value: 'soft' }]);
  });

  it('always orders finish, thickness, stretch, feel', () => {
    const chips = visibleChips(fabric({
      feel: 'soft', stretch: 'high', thickness: 'thin', finish: 'glossy',
    }));
    expect(chips.map(c => c.group)).toEqual(['finish', 'thickness', 'stretch', 'feel']);
  });

  it('does not treat a technical field as a chip', () => {
    expect(visibleChips(fabric({ composition: 'cotton 100%' }))).toEqual([]);
  });
});

describe('technicalRows', () => {
  it('returns nothing when every technical field is null', () => {
    expect(technicalRows(null)).toEqual([]);
    expect(technicalRows(fabric({ finish: 'matte' }))).toEqual([]);
  });

  it('stringifies numbers and keeps declaration order', () => {
    expect(technicalRows(fabric({
      notes: 'ซักมือ', weight_gsm: 180, composition: 'cotton 100%', pore_size_mm: 0.25,
    }))).toEqual([
      { key: 'composition', value: 'cotton 100%' },
      { key: 'weight_gsm', value: '180' },
      { key: 'pore_size_mm', value: '0.25' },
      { key: 'notes', value: 'ซักมือ' },
    ]);
  });

  it('drops a blank string but keeps a value that is really set', () => {
    expect(technicalRows(fabric({ composition: '   ' }))).toEqual([]);
    expect(technicalRows(fabric({ thread_count: 400 })))
      .toEqual([{ key: 'thread_count', value: '400' }]);
  });
});

describe('dotsWithOverflow', () => {
  it('shows everything and no overflow at or under the cap', () => {
    const six = [1, 2, 3, 4, 5, 6];
    expect(dotsWithOverflow(six)).toEqual({ shown: six, extra: 0 });
    expect(dotsWithOverflow([1, 2])).toEqual({ shown: [1, 2], extra: 0 });
    expect(dotsWithOverflow([])).toEqual({ shown: [], extra: 0 });
  });

  it('caps at six and reports the remainder', () => {
    expect(dotsWithOverflow([1, 2, 3, 4, 5, 6, 7, 8, 9]))
      .toEqual({ shown: [1, 2, 3, 4, 5, 6], extra: 3 });
  });
});
