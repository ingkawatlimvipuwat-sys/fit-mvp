import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadProductContext, checkGarmentOwnership } from './ownership';

type Row = Record<string, unknown>;

/** In-memory stand-in: .from(t).select().eq(c, v)... filters rows; awaiting or maybeSingle() returns them. */
function fake(tables: Record<string, Row[]>, failTable?: string): SupabaseClient {
  return {
    from(table: string) {
      const filters: [string, unknown][] = [];
      function run(single: boolean) {
        if (table === failTable) return { data: null, error: { message: 'boom' } };
        const rows = (tables[table] ?? []).filter(r => filters.every(([c, v]) => r[c] === v));
        return { data: single ? rows[0] ?? null : rows, error: null };
      }
      const b: Record<string, unknown> = {
        select: () => b,
        eq: (c: string, v: unknown) => { filters.push([c, v]); return b; },
        order: () => b,
        maybeSingle: async () => run(true),
        then: (res: (v: unknown) => unknown) => Promise.resolve(run(false)).then(res),
      };
      return b;
    },
  } as unknown as SupabaseClient;
}

const DB = {
  products: [{ id: 'P1', retailer_id: 'A', name: 'Tee' }, { id: 'P2', retailer_id: 'B', name: 'Other' }],
  product_pickers: [{ id: 'k1', product_id: 'P1', name: 'Size', position: 0 }],
  garments: [
    { id: 'G1', retailer_id: 'A', product_id: 'P1', picks: { k1: 'L' }, category: 'top', measurements: {}, created_at: '2026-01-01T00:00:00Z' },
    { id: 'G2', retailer_id: 'B', product_id: 'P2', picks: {}, category: 'top', measurements: {}, created_at: '2026-01-01T00:00:00Z' },
  ],
};

describe('loadProductContext', () => {
  it('loads own product with pickers and versions', async () => {
    const r = await loadProductContext(fake(DB), 'A', 'P1');
    expect(r.ok && r.ctx.pickers.map(p => p.id)).toEqual(['k1']);
    expect(r.ok && r.ctx.versions.map(v => v.id)).toEqual(['G1']);
  });
  it("another shop's product is a 404, same as nonexistent", async () => {
    expect(await loadProductContext(fake(DB), 'A', 'P2')).toMatchObject({ ok: false, status: 404 });
    expect(await loadProductContext(fake(DB), 'A', 'nope')).toMatchObject({ ok: false, status: 404 });
  });
  it('fails closed with 500 when the lookup errors', async () => {
    expect(await loadProductContext(fake(DB, 'products'), 'A', 'P1')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('checkGarmentOwnership', () => {
  it('accepts own garment', async () => {
    expect(await checkGarmentOwnership(fake(DB), 'A', 'G1')).toMatchObject({ ok: true });
  });
  it("rejects another shop's garment as 404", async () => {
    expect(await checkGarmentOwnership(fake(DB), 'A', 'G2')).toMatchObject({ ok: false, status: 404 });
  });
  it('fails closed with 500 when the lookup errors', async () => {
    expect(await checkGarmentOwnership(fake(DB, 'garments'), 'A', 'G1')).toMatchObject({ ok: false, status: 500 });
  });
});
