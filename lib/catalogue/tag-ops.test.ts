import { describe, it, expect } from 'vitest';
import { attachTagByName, detachTag, renameTag, deleteTag } from './tag-ops';
import { t } from '@/lib/i18n/strings';
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

describe('renameTag', () => {
  const withT2 = () => { const d = db(); d.tags.push({ id: 'T2', retailer_id: 'A', name: 'Summer' }); return d; };

  it("renames the caller's tag, scoped to the caller's shop", async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'T1', 'Big sale')).toEqual({ ok: true, tag: { id: 'T1', name: 'Big sale' } });
    expect(f.tables.tags.find(x => x.id === 'T1')?.name).toBe('Big sale');
    expect(f.calls.filter(c => c.op === 'update')).toEqual([
      { table: 'tags', op: 'update', eq: { id: 'T1', retailer_id: 'A' }, values: { name: 'Big sale' } },
    ]);
  });
  it("another shop's tag is a 404 and nothing is written", async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'TB', 'Mine now')).toMatchObject({ ok: false, status: 404 });
    expect(f.calls.some(c => c.op === 'update')).toBe(false);
  });
  it('a name another of my tags has is refused with 409 naming that tag, nothing written', async () => {
    const f = fakeSupabase(withT2());
    const r = await renameTag(f.client, 'A', 'T1', 'summer');
    expect(r).toMatchObject({ ok: false, status: 409, error: t.tagNameTaken.th.replace('{name}', 'Summer') });
    expect(f.calls.some(c => c.op === 'update')).toBe(false);
  });
  it("another shop's tag of that name is not a clash", async () => {
    const f = fakeSupabase(db());
    expect(await renameTag(f.client, 'A', 'T1', 'Summer')).toMatchObject({ ok: true });
  });
  it('changing only capitals is allowed', async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'T1', 'SALE')).toMatchObject({ ok: true, tag: { name: 'SALE' } });
  });
  it('the exact same name is a no-op with no write', async () => {
    const f = fakeSupabase(withT2());
    expect(await renameTag(f.client, 'A', 'T1', 'Sale')).toMatchObject({ ok: true });
    expect(f.calls.some(c => c.op === 'update')).toBe(false);
  });
  it('a clash the database catches (another tab) is still a 409', async () => {
    const f = fakeSupabase(withT2(), { fail: { table: 'tags', op: 'update', code: '23505' } });
    expect(await renameTag(f.client, 'A', 'T1', 'Winter')).toMatchObject({ ok: false, status: 409 });
  });
  it('fails closed: lookup or update failure is a 500', async () => {
    expect(await renameTag(fakeSupabase(withT2(), { fail: { table: 'tags', op: 'select' } }).client, 'A', 'T1', 'X'))
      .toMatchObject({ ok: false, status: 500 });
    expect(await renameTag(fakeSupabase(withT2(), { fail: { table: 'tags', op: 'update', code: 'XX000' } }).client, 'A', 'T1', 'X'))
      .toMatchObject({ ok: false, status: 500 });
  });
});

describe('deleteTag', () => {
  it("deletes the caller's tag with one statement scoped to the shop (links go by ON DELETE CASCADE)", async () => {
    const f = fakeSupabase(db());
    expect(await deleteTag(f.client, 'A', 'T1')).toEqual({ ok: true });
    expect(f.tables.tags.map(x => x.id)).toEqual(['TB']);
    expect(f.calls.filter(c => c.op === 'delete')).toEqual([
      { table: 'tags', op: 'delete', eq: { id: 'T1', retailer_id: 'A' }, values: undefined },
    ]);
  });
  it("another shop's tag is a 404 and nothing is deleted", async () => {
    const f = fakeSupabase(db());
    expect(await deleteTag(f.client, 'A', 'TB')).toMatchObject({ ok: false, status: 404 });
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('fails closed when the lookup fails, before any delete', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'select' } });
    expect(await deleteTag(f.client, 'A', 'T1')).toMatchObject({ ok: false, status: 500 });
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('a failed delete is a 500', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'tags', op: 'delete' } });
    expect(await deleteTag(f.client, 'A', 'T1')).toMatchObject({ ok: false, status: 500 });
  });
});
