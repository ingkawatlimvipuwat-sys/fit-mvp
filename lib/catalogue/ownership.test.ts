import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import { loadProductContext, checkGarmentOwnership, loadShopFolders, checkFolderOwnership, loadShopTags, checkTagOwnership } from './ownership';

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
    expect(await loadProductContext(fake(DB), 'A', 'P2')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
    expect(await loadProductContext(fake(DB), 'A', 'nope')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
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
    expect(await checkGarmentOwnership(fake(DB), 'A', 'G2')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
  });
  it('fails closed with 500 when the lookup errors', async () => {
    expect(await checkGarmentOwnership(fake(DB, 'garments'), 'A', 'G1')).toMatchObject({ ok: false, status: 500 });
  });
});

const FOLDERS = {
  folders: [
    { id: 'F1', retailer_id: 'A', name: 'Shirts', parent_id: null },
    { id: 'F2', retailer_id: 'B', name: 'Theirs', parent_id: null },
  ],
};

describe('loadShopFolders', () => {
  it("lists only the caller's folders", async () => {
    const r = await loadShopFolders(fake(FOLDERS), 'A');
    expect(r.ok && r.folders.map(f => f.id)).toEqual(['F1']);
  });
  it('fails closed with 500, never an empty list', async () => {
    expect(await loadShopFolders(fake(FOLDERS, 'folders'), 'A')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('checkFolderOwnership', () => {
  it('accepts own folder', async () => {
    expect(await checkFolderOwnership(fake(FOLDERS), 'A', 'F1')).toEqual({ ok: true });
  });
  it("rejects another shop's folder as 404, same as nonexistent", async () => {
    expect(await checkFolderOwnership(fake(FOLDERS), 'A', 'F2')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
    expect(await checkFolderOwnership(fake(FOLDERS), 'A', 'nope')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
  });
  it('fails closed with 500', async () => {
    expect(await checkFolderOwnership(fake(FOLDERS, 'folders'), 'A', 'F1')).toMatchObject({ ok: false, status: 500 });
  });
});

const TAGS = {
  tags: [
    { id: 'T1', retailer_id: 'A', name: 'Sale' },
    { id: 'T2', retailer_id: 'B', name: 'Theirs' },
  ],
};

describe('loadShopTags', () => {
  it("lists only the caller's tags", async () => {
    const r = await loadShopTags(fake(TAGS), 'A');
    expect(r.ok && r.tags.map(x => x.id)).toEqual(['T1']);
  });
  it('fails closed with 500, never an empty list', async () => {
    expect(await loadShopTags(fake(TAGS, 'tags'), 'A')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('checkTagOwnership', () => {
  it('accepts own tag', async () => {
    expect(await checkTagOwnership(fake(TAGS), 'A', 'T1')).toEqual({ ok: true });
  });
  it("rejects another shop's tag as 404, same as nonexistent", async () => {
    expect(await checkTagOwnership(fake(TAGS), 'A', 'T2')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
    expect(await checkTagOwnership(fake(TAGS), 'A', 'nope')).toMatchObject({ ok: false, status: 404, error: t.itemNotFound.th });
  });
  it('fails closed with 500', async () => {
    expect(await checkTagOwnership(fake(TAGS, 'tags'), 'A', 'T1')).toMatchObject({ ok: false, status: 500 });
  });
});
