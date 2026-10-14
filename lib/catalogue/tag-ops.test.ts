import { describe, it, expect } from 'vitest';
import { attachTagByName, detachTag } from './tag-ops';
import { fakeSupabase, type Row } from './fake-supabase';

const UNIQUE = {
  tags: (r: Row) => `${r.retailer_id}|${String(r.name).toLowerCase()}`,
  product_tags: (r: Row) => `${r.product_id}|${r.tag_id}`,
};
function db(): Record<string, Row[]> {
  return {
    tags: [
      { id: 'T1', retailer_id: 'A', name: 'Sale' },
      { id: 'TB', retailer_id: 'B', name: 'Summer' },
    ],
    product_tags: [],
  };
}

describe('attachTagByName', () => {
  it('reuses an existing tag, case-insensitively', async () => {
    const f = fakeSupabase(db(), { unique: UNIQUE });
    expect(await attachTagByName(f.client, 'A', 'P1', 'sALE')).toMatchObject({ ok: true, tag: { id: 'T1' } });
    expect(f.tables.tags).toHaveLength(2);
    expect(f.tables.product_tags).toMatchObject([{ product_id: 'P1', tag_id: 'T1' }]);
  });
  it("creates a new tag for the caller, never reusing another shop's tag of the same name", async () => {
    const f = fakeSupabase(db(), { unique: UNIQUE });
    const r = await attachTagByName(f.client, 'A', 'P1', 'Summer');
    expect(r.ok && r.tag.id).not.toBe('TB');
    expect(f.tables.tags.filter(x => x.retailer_id === 'A' && x.name === 'Summer')).toHaveLength(1);
    expect(f.tables.product_tags).toMatchObject([{ product_id: 'P1', tag_id: r.ok ? r.tag.id : '' }]);
  });
  it('attaching a tag the product already has is fine', async () => {
    const data = db();
    data.product_tags.push({ product_id: 'P1', tag_id: 'T1' });
    const f = fakeSupabase(data, { unique: UNIQUE });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Sale')).toMatchObject({ ok: true });
    expect(f.tables.product_tags).toHaveLength(1);
  });
  it('fails closed when the tag lookup fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'select' } });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Sale')).toMatchObject({ ok: false, status: 500 });
  });
  it('fails closed on an unexplained duplicate-name clash', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'insert', code: '23505' } });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Winter')).toMatchObject({ ok: false, status: 500 });
    expect(f.tables.product_tags).toHaveLength(0);
  });
  it('fails closed when linking fails for another reason', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'product_tags', op: 'insert', code: 'XX000' } });
    expect(await attachTagByName(f.client, 'A', 'P1', 'Sale')).toMatchObject({ ok: false, status: 500 });
  });
});

describe('detachTag', () => {
  it('removes only the link; the tag itself stays', async () => {
    const data = db();
    data.product_tags.push({ product_id: 'P1', tag_id: 'T1' }, { product_id: 'P2', tag_id: 'T1' });
    const f = fakeSupabase(data);
    expect(await detachTag(f.client, 'A', 'P1', 'T1')).toEqual({ ok: true });
    expect(f.tables.product_tags).toEqual([{ product_id: 'P2', tag_id: 'T1' }]);
    expect(f.tables.tags).toHaveLength(2);
  });
  it("another shop's tag id is 404 and nothing is deleted", async () => {
    const f = fakeSupabase(db());
    expect(await detachTag(f.client, 'A', 'P1', 'TB')).toMatchObject({ ok: false, status: 404 });
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('fails closed when the delete fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'product_tags', op: 'delete' } });
    expect(await detachTag(f.client, 'A', 'P1', 'T1')).toMatchObject({ ok: false, status: 500 });
  });
});
