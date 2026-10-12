import { describe, it, expect } from 'vitest';
import {
  folderLines, childFolders, subtreeIds, wouldCreateCycle, ancestors, moveTargets, type FolderRow,
} from './folders';

const F = (id: string, parent_id: string | null, name = id): FolderRow => ({ id, name, parent_id });
// Shirts > Linen > Short sleeve ; Trousers ; Dresses  (deliberately out of order)
const TREE: FolderRow[] = [
  F('trousers', null, 'Trousers'),
  F('linen', 'shirts', 'Linen'),
  F('short', 'linen', 'Short sleeve'),
  F('shirts', null, 'Shirts'),
  F('dresses', null, 'Dresses'),
];

describe('folderLines', () => {
  it('lists depth-first with siblings A–Z', () => {
    expect(folderLines(TREE).map(f => [f.id, f.depth])).toEqual([
      ['dresses', 0], ['shirts', 0], ['linen', 1], ['short', 2], ['trousers', 0],
    ]);
  });
  it('sorts names case-insensitively and numerically', () => {
    expect(folderLines([F('x', null, 'b10'), F('y', null, 'B2'), F('z', null, 'a')]).map(f => f.name))
      .toEqual(['a', 'B2', 'b10']);
  });
  it('shows a folder whose parent is missing at the top level', () => {
    expect(folderLines([F('x', 'gone')]).map(f => [f.id, f.depth])).toEqual([['x', 0]]);
  });
  it('never loses folders caught in a cycle, and never loops', () => {
    expect(folderLines([F('a', 'b', 'A'), F('b', 'a', 'B')]).map(f => f.id).sort()).toEqual(['a', 'b']);
  });
  it('empty in, empty out', () => { expect(folderLines([])).toEqual([]); });
});

describe('childFolders', () => {
  it('top level, A–Z', () => {
    expect(childFolders(TREE, null).map(f => f.id)).toEqual(['dresses', 'shirts', 'trousers']);
  });
  it('direct children only', () => {
    expect(childFolders(TREE, 'shirts').map(f => f.id)).toEqual(['linen']);
  });
  it('unknown folder has none', () => { expect(childFolders(TREE, 'nope')).toEqual([]); });
});

describe('subtreeIds', () => {
  it('is the folder and every folder below it', () => {
    expect([...subtreeIds(TREE, 'shirts')].sort()).toEqual(['linen', 'shirts', 'short']);
  });
  it('a leaf is just itself', () => { expect([...subtreeIds(TREE, 'short')]).toEqual(['short']); });
  it('an unknown id is empty', () => { expect(subtreeIds(TREE, 'nope').size).toBe(0); });
  it('terminates on a cycle', () => { expect(subtreeIds([F('a', 'b'), F('b', 'a')], 'a').size).toBe(2); });
});

describe('wouldCreateCycle (rule 5)', () => {
  it('refuses moving a folder into itself', () => { expect(wouldCreateCycle(TREE, 'shirts', 'shirts')).toBe(true); });
  it('refuses its own child', () => { expect(wouldCreateCycle(TREE, 'shirts', 'linen')).toBe(true); });
  it('refuses a deep descendant', () => { expect(wouldCreateCycle(TREE, 'shirts', 'short')).toBe(true); });
  it('allows a sibling, an ancestor and the top level', () => {
    expect(wouldCreateCycle(TREE, 'short', 'trousers')).toBe(false);
    expect(wouldCreateCycle(TREE, 'short', 'shirts')).toBe(false);
    expect(wouldCreateCycle(TREE, 'linen', null)).toBe(false);
  });
});

describe('ancestors', () => {
  it('top level first, the folder itself excluded', () => {
    expect(ancestors(TREE, 'short').map(f => f.id)).toEqual(['shirts', 'linen']);
  });
  it('a top-level folder has none', () => { expect(ancestors(TREE, 'shirts')).toEqual([]); });
  it('terminates on a cycle', () => {
    expect(ancestors([F('a', 'b'), F('b', 'a')], 'a').map(f => f.id)).toEqual(['b']);
  });
});

describe('moveTargets', () => {
  it('moving a folder: Top level first; itself and everything below it disabled; its current parent marked', () => {
    const rows = moveTargets(TREE, { kind: 'folder', id: 'linen' });
    expect(rows[0]).toMatchObject({ id: null, disabled: false, current: false });
    const by = Object.fromEntries(rows.slice(1).map(r => [String(r.id), r]));
    expect(by.linen.disabled).toBe(true);
    expect(by.short.disabled).toBe(true);
    expect(by.shirts).toMatchObject({ current: true, disabled: true });
    expect(by.trousers).toMatchObject({ current: false, disabled: false });
  });
  it('moving a top-level product: Top level is current; every folder is allowed', () => {
    const rows = moveTargets(TREE, { kind: 'product', folderId: null });
    expect(rows[0]).toMatchObject({ current: true, disabled: true });
    expect(rows.slice(1).every(r => !r.disabled)).toBe(true);
  });
  it('folders are indented one level deeper than Top level', () => {
    expect(moveTargets(TREE, { kind: 'product', folderId: 'short' }).map(r => r.depth)).toEqual([0, 1, 1, 2, 3, 1]);
  });
});
