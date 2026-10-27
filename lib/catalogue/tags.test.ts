import { describe, it, expect } from 'vitest';
import { normTag, findTagByName, tagsOfProduct, tagsInUse, tagSuggestions, tagUsage, tagNameClash, type TagRow } from './tags';

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

describe('tagUsage', () => {
  it('every shop tag A–Z with its product count, unused tags included, foreign links ignored', () => {
    expect(tagUsage(TAGS, LINKS)).toEqual([
      { id: 'o', name: 'Old typo', count: 0 },
      { id: 'a', name: 'Sale', count: 2 },
      { id: 's', name: 'Summer', count: 1 },
    ]);
  });
  it('counts a product once even if the link is listed twice', () => {
    expect(tagUsage([{ id: 'a', name: 'Sale' }], [
      { product_id: 'P1', tag_id: 'a' }, { product_id: 'P1', tag_id: 'a' },
    ])[0].count).toBe(1);
  });
});

describe('tagNameClash', () => {
  it('finds another tag with the same name, trimmed and ignoring capitals', () => {
    expect(tagNameClash(TAGS, 's', ' SALE ')?.id).toBe('a');
  });
  it('a tag never clashes with itself (changing only capitals is allowed)', () => {
    expect(tagNameClash(TAGS, 'a', 'SALE')).toBe(null);
  });
  it('a free name has no clash', () => { expect(tagNameClash(TAGS, 'a', 'Winter')).toBe(null); });
});
