import { describe, it, expect } from 'vitest';
import { parseColoursField, parseFabricField, isFabricEmpty } from './colour-fabric';
import { showColourTab, showFabricTab } from './colour-fabric-view';

/**
 * The spec asks that an existing garment with no colour or fabric data keep
 * behaving exactly as it did before this feature. There is no route or database
 * harness on this project, so — following the precedent set by
 * `round-trip.test.ts` for the garment edit page — the claim is pinned at the
 * pure-function layer the routes branch on, not over HTTP.
 *
 * Everything below is about the difference between "absent" and "empty". Get it
 * wrong and a request that never mentioned colours deletes the retailer's list.
 */

/** A request from a client that knows nothing about colour or fabric. */
function legacyForm(): FormData {
  const f = new FormData();
  f.set('name', 'เสื้อยืดคอกลม');
  f.set('category', 'top');
  f.set('fit_profile', 'regular');
  f.set('chest', '100');
  return f;
}

describe('a request with no colour or fabric fields', () => {
  it('reports both as ABSENT, never as empty', () => {
    // A stale browser tab, a retry, or a future script that posts a garment
    // without these fields must not be read as "the retailer cleared them".
    expect(parseColoursField(legacyForm())).toEqual({ ok: true, present: false });
    expect(parseFabricField(legacyForm())).toEqual({ ok: true, present: false });
  });

  it('is distinguishable from a request that deliberately clears the data', () => {
    const cleared = legacyForm();
    cleared.set('colours', '[]');
    cleared.set('fabric', '{}');

    const absent = parseColoursField(legacyForm());
    const empty = parseColoursField(cleared);

    // Same "no colours" outcome, opposite instructions to the route: leave it
    // alone, versus replace it with nothing. `present` is the only signal the
    // routes branch on, so these two must never collapse into one value.
    expect(absent.ok && absent.present).toBe(false);
    expect(empty.ok && empty.present).toBe(true);
    expect(empty.ok && empty.present && empty.colours).toEqual([]);

    expect(parseFabricField(cleared).ok && parseFabricField(cleared).present).toBe(true);
  });

  it('parses the garment fields it does carry without complaint', () => {
    // The new parsers must not reject a legacy request outright — that would
    // turn "no colour data" into a 400 for every pre-existing garment.
    expect(parseColoursField(legacyForm()).ok).toBe(true);
    expect(parseFabricField(legacyForm()).ok).toBe(true);
  });
});

describe('a garment with no colour or fabric data', () => {
  it('shows no tabs, so the shopper page renders as it did before', () => {
    expect(showColourTab([], null)).toBe(false);
    expect(showFabricTab(null)).toBe(false);
  });

  it('shows no Fabric tab even if an all-null row somehow exists', () => {
    // A row can survive as all-null: text fields cleared while a photo held it
    // alive, then the photo gone. It must not produce an empty tab.
    const allNull = {
      garment_id: 'f0e1d2c3-0000-4000-8000-000000000000',
      updated_at: '2026-09-11T00:00:00Z',
      fabric_photo_url: null,
      finish: null, thickness: null, stretch: null, feel: null,
      composition: null, weight_gsm: null, construction: null,
      thread_count: null, pore_size_mm: null, notes: null,
    };
    expect(isFabricEmpty(allNull)).toBe(true);
    expect(showFabricTab(allNull)).toBe(false);
  });
});
