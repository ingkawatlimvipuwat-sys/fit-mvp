import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n/strings';
import { checkFolderMove, deleteFolderMovingUp } from './folder-ops';
import { fakeSupabase, type Row } from './fake-supabase';
import type { FolderRow } from './folders';

const MINE: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'short', name: 'Short sleeve', parent_id: 'linen' },
];

describe('checkFolderMove', () => {
  it('allows a legal move and a move to the top level', () => {
    expect(checkFolderMove(MINE, 'short', 'shirts')).toEqual({ ok: true });
    expect(checkFolderMove(MINE, 'linen', null)).toEqual({ ok: true });
  });
  it("another shop's (or unknown) folder is 404", () => {
    expect(checkFolderMove(MINE, 'theirs', null)).toMatchObject({ ok: false, status: 404 });
  });
  it("another shop's (or unknown) destination is 404", () => {
    expect(checkFolderMove(MINE, 'linen', 'theirs')).toMatchObject({ ok: false, status: 404 });
  });
  it('a move into itself or below itself is 409 with the Thai message (rule 5)', () => {
    expect(checkFolderMove(MINE, 'shirts', 'short')).toEqual({ ok: false, status: 409, error: t.folderCycle.th });
    expect(checkFolderMove(MINE, 'shirts', 'shirts')).toMatchObject({ ok: false, status: 409 });
  });
});

function db(): Record<string, Row[]> {
  return {
    folders: [
      { id: 'shirts', retailer_id: 'A', name: 'Shirts', parent_id: null },
      { id: 'linen', retailer_id: 'A', name: 'Linen', parent_id: 'shirts' },
      { id: 'short', retailer_id: 'A', name: 'Short sleeve', parent_id: 'linen' },
      { id: 'long', retailer_id: 'A', name: 'Long sleeve', parent_id: 'linen' },
      // Impossible through the app; proves every statement is scoped to the caller.
      { id: 'theirs', retailer_id: 'B', name: 'Theirs', parent_id: 'linen' },
    ],
    products: [
      { id: 'p1', retailer_id: 'A', folder_id: 'linen' },
      { id: 'p2', retailer_id: 'A', folder_id: 'short' },
      { id: 'p3', retailer_id: 'A', folder_id: null },
      { id: 'pB', retailer_id: 'B', folder_id: 'linen' },
    ],
  };
}
const LINEN: FolderRow = { id: 'linen', name: 'Linen', parent_id: 'shirts' };
const find = (rows: Row[], id: string) => rows.find(r => r.id === id);

describe('deleteFolderMovingUp (rule 6)', () => {
  it('moves subfolders and products up one level, then deletes only the folder', async () => {
    const f = fakeSupabase(db());
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toEqual({ ok: true });
    expect(f.tables.folders.map(r => r.id)).not.toContain('linen');
    expect(find(f.tables.folders, 'short')?.parent_id).toBe('shirts');
    expect(find(f.tables.folders, 'long')?.parent_id).toBe('shirts');
    expect(find(f.tables.products, 'p1')?.folder_id).toBe('shirts');
    expect(find(f.tables.products, 'p2')?.folder_id).toBe('short'); // deeper contents untouched
    expect(f.tables.products).toHaveLength(4); // nothing deleted
  });
  it("a top-level folder's contents move to the top level", async () => {
    const f = fakeSupabase(db());
    await deleteFolderMovingUp(f.client, 'A', { id: 'shirts', name: 'Shirts', parent_id: null });
    expect(find(f.tables.folders, 'linen')?.parent_id).toBe(null);
  });
  it("every statement is scoped to the caller's shop", async () => {
    const f = fakeSupabase(db());
    await deleteFolderMovingUp(f.client, 'A', LINEN);
    expect(f.calls.every(c => c.eq.retailer_id === 'A')).toBe(true);
    expect(find(f.tables.folders, 'theirs')?.parent_id).toBe('linen');
    expect(find(f.tables.products, 'pB')?.folder_id).toBe('linen');
  });
  it('moves everything before deleting', async () => {
    const f = fakeSupabase(db());
    await deleteFolderMovingUp(f.client, 'A', LINEN);
    expect(f.calls.map(c => `${c.table}.${c.op}`)).toEqual(['folders.update', 'products.update', 'folders.delete']);
  });
  it('stops before deleting when moving products fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'products', op: 'update' } });
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toMatchObject({ ok: false, status: 500 });
    expect(f.tables.folders.map(r => r.id)).toContain('linen');
    expect(f.calls.some(c => c.op === 'delete')).toBe(false);
  });
  it('stops at once when moving subfolders fails', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'folders', op: 'update' } });
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toMatchObject({ ok: false, status: 500 });
    expect(f.calls.map(c => c.op)).toEqual(['update']);
  });
  it('reports a failed delete as 500', async () => {
    const f = fakeSupabase(db(), { fail: { table: 'folders', op: 'delete' } });
    expect(await deleteFolderMovingUp(f.client, 'A', LINEN)).toMatchObject({ ok: false, status: 500 });
  });
});
