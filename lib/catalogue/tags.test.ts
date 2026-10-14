import { describe, it, expect } from 'vitest';
import { normTag, findTagByName, tagsOfProduct, tagsInUse, tagSuggestions, type TagRow } from './tags';

const TAGS: TagRow[] = [{ id: 's', name: 'Summer' }, { id: 'a', name: 'Sale' }, { id: 'o', name: 'Old typo' }];
const LINKS = [
  { product_id: 'P1', tag_id: 's' }, { product_id: 'P1', tag_id: 'a' },
  { product_id: 'P2', tag_id: 'a' },
  { product_id: 'P1', tag_id: 'foreign' }, // another shop's tag id: never shown
];

describe('normTag', () => { it('trims and lowercases', () => { expect(normTag('  SALE ')).toBe('sale'); }); });

describe('findTagByName', () => {
  it('matches trimmed and case-insensitively', () => { expect(findTagByName(TAGS, ' sale ')?.id).toBe('a'); });
  it('null when absent', () => { expect(findTagByName(TAGS, 'Winter')).toBe(null); });
});

describe('tagsOfProduct', () => {
  it("a product's own tags, A–Z, ignoring ids outside the shop's tags", () => {
    expect(tagsOfProduct('P1', TAGS, LINKS).map(t => t.name)).toEqual(['Sale', 'Summer']);
  });
  it('none', () => { expect(tagsOfProduct('P3', TAGS, LINKS)).toEqual([]); });
});

describe('tagsInUse (open question 2: a tag on no product is hidden)', () => {
  it('only tags on at least one product, A–Z', () => {
    expect(tagsInUse(TAGS, LINKS).map(t => t.id)).toEqual(['a', 's']);
  });
});

describe('tagSuggestions', () => {
  it('in-use tags not already on this product', () => {
    expect(tagSuggestions(tagsInUse(TAGS, LINKS), tagsOfProduct('P2', TAGS, LINKS)).map(t => t.id)).toEqual(['s']);
  });
});
