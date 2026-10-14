import { describe, it, expect } from 'vitest';
import { parseView, viewToQuery, productsInView } from './browse';
import type { FolderRow } from './folders';

const FOLDERS: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'trousers', name: 'Trousers', parent_id: null },
];
const P = (id: string, folder_id: string | null) => ({ id, folder_id });
const PRODUCTS = [P('top', null), P('inShirts', 'shirts'), P('inLinen', 'linen'), P('inTrousers', 'trousers')];
const qs = (s: string) => new URLSearchParams(s);

describe('parseView', () => {
  it('reads a known folder', () => { expect(parseView(qs('folder=linen'), FOLDERS)).toEqual({ folderId: 'linen' }); });
  it("an unknown, deleted or another shop's folder falls back to All items", () => {
    expect(parseView(qs('folder=zzz'), FOLDERS)).toEqual({ folderId: null });
  });
  it('no folder is All items', () => { expect(parseView(qs(''), FOLDERS)).toEqual({ folderId: null }); });
});

describe('viewToQuery', () => {
  it('round-trips a folder', () => {
    expect(parseView(qs(viewToQuery({ folderId: 'linen' })), FOLDERS)).toEqual({ folderId: 'linen' });
  });
  it('All items is the empty query', () => { expect(viewToQuery({ folderId: null })).toBe(''); });
});

describe('productsInView (open question 1: a folder shows everything below it)', () => {
  it('All items shows every product, in the given order', () => {
    expect(productsInView(PRODUCTS, FOLDERS, { folderId: null }).map(p => p.id))
      .toEqual(['top', 'inShirts', 'inLinen', 'inTrousers']);
  });
  it('a folder shows its own products and those of every folder below it', () => {
    expect(productsInView(PRODUCTS, FOLDERS, { folderId: 'shirts' }).map(p => p.id)).toEqual(['inShirts', 'inLinen']);
  });
  it('a leaf folder shows only its own', () => {
    expect(productsInView(PRODUCTS, FOLDERS, { folderId: 'linen' }).map(p => p.id)).toEqual(['inLinen']);
  });
});
