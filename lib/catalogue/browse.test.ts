import { describe, it, expect } from 'vitest';
import { parseView, viewToQuery, productsInView, sortProducts, matchesSearch, isFiltered, DEFAULT_VIEW, type DashboardView } from './browse';
import type { FolderRow } from './folders';

const FOLDERS: FolderRow[] = [
  { id: 'shirts', name: 'Shirts', parent_id: null },
  { id: 'linen', name: 'Linen', parent_id: 'shirts' },
  { id: 'trousers', name: 'Trousers', parent_id: null },
];
const TAG_IDS = ['sale', 'summer'];
const P = (id: string, name: string, created_at: string, folder_id: string | null, tags: string[] = [], needsAttention = false) =>
  ({ id, name, created_at, folder_id, needsAttention, tags: tags.map(t => ({ id: t, name: t })) });
const PRODUCTS = [
  P('p1', 'Linen Shirt', '2026-03-01', 'linen', ['sale', 'summer']),
  P('p2', 'linen tunic', '2026-02-01', 'linen', ['sale'], true),
  P('p3', 'Chinos', '2026-04-01', 'trousers', ['summer']),
  P('p4', 'เสื้อลินิน', '2026-01-01', null),
];
const qs = (s: string) => new URLSearchParams(s);
const V = (over: Partial<DashboardView>): DashboardView => ({ ...DEFAULT_VIEW, ...over });
const ids = (xs: { id: string }[]) => xs.map(x => x.id);

describe('parseView', () => {
  it('reads every field', () => {
    expect(parseView(qs('folder=linen&q=shirt&tags=sale,summer&sort=az&attention=1'), FOLDERS, TAG_IDS))
      .toEqual({ folderId: 'linen', q: 'shirt', tagIds: ['sale', 'summer'], sort: 'az', attention: true });
  });
  it('defaults', () => { expect(parseView(qs(''), FOLDERS, TAG_IDS)).toEqual(DEFAULT_VIEW); });
  it('drops unknown folders, unknown or repeated tags and bad sorts', () => {
    expect(parseView(qs('folder=zzz&tags=sale,zzz,sale&sort=price'), FOLDERS, TAG_IDS))
      .toEqual(V({ tagIds: ['sale'] }));
  });
  it('caps the search at 100 characters', () => {
    expect(parseView(qs(`q=${'x'.repeat(150)}`), FOLDERS, TAG_IDS).q).toHaveLength(100);
  });
});

describe('viewToQuery', () => {
  it('the default view is the empty query', () => { expect(viewToQuery(DEFAULT_VIEW)).toBe(''); });
  it('round-trips', () => {
    const v = V({ folderId: 'linen', q: 'เสื้อ', tagIds: ['sale', 'summer'], sort: 'za', attention: true });
    expect(parseView(qs(viewToQuery(v)), FOLDERS, TAG_IDS)).toEqual(v);
  });
  it('omits a blank search', () => { expect(viewToQuery(V({ q: '   ' }))).toBe(''); });
});

describe('matchesSearch', () => {
  it('substring, trimmed, case-insensitive; blank matches all', () => {
    expect(matchesSearch('Linen Shirt', '  SHIRT ')).toBe(true);
    expect(matchesSearch('Linen Shirt', 'tunic')).toBe(false);
    expect(matchesSearch('เสื้อลินิน', 'ลินิน')).toBe(true);
    expect(matchesSearch('anything', '')).toBe(true);
  });
});

describe('sortProducts', () => {
  it('newest and oldest by created_at', () => {
    expect(ids(sortProducts(PRODUCTS, 'newest'))).toEqual(['p3', 'p1', 'p2', 'p4']);
    expect(ids(sortProducts(PRODUCTS, 'oldest'))).toEqual(['p4', 'p2', 'p1', 'p3']);
  });
  it('name A–Z and Z–A, case-insensitive', () => {
    const latin = PRODUCTS.slice(0, 3);
    expect(ids(sortProducts(latin, 'az'))).toEqual(['p3', 'p1', 'p2']);
    expect(ids(sortProducts(latin, 'za'))).toEqual(['p2', 'p1', 'p3']);
  });
  it('does not change the input array', () => {
    const copy = [...PRODUCTS];
    sortProducts(PRODUCTS, 'az');
    expect(PRODUCTS).toEqual(copy);
  });
});

describe('productsInView', () => {
  it('All items, no filters: every product, newest first', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, DEFAULT_VIEW))).toEqual(['p3', 'p1', 'p2', 'p4']);
  });
  it('a folder covers everything below it', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ folderId: 'shirts' })))).toEqual(['p1', 'p2']);
  });
  it('search covers the current folder and below only', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ folderId: 'trousers', q: 'linen' })))).toEqual([]);
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ q: 'linen' })))).toEqual(['p1', 'p2']);
  });
  it('several tags = products having ALL of them', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ tagIds: ['sale'] })))).toEqual(['p1', 'p2']);
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ tagIds: ['sale', 'summer'] })))).toEqual(['p1']);
  });
  it('Needs attention keeps only flagged products', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ attention: true })))).toEqual(['p2']);
  });
  it('filters combine', () => {
    expect(ids(productsInView(PRODUCTS, FOLDERS, V({ folderId: 'linen', tagIds: ['summer'], q: 'shirt' })))).toEqual(['p1']);
  });
});

describe('isFiltered', () => {
  it('search, tags or attention count; folder and sort do not', () => {
    expect(isFiltered(V({ folderId: 'linen', sort: 'az' }))).toBe(false);
    expect(isFiltered(V({ q: ' x ' }))).toBe(true);
    expect(isFiltered(V({ tagIds: ['sale'] }))).toBe(true);
    expect(isFiltered(V({ attention: true }))).toBe(true);
  });
});
