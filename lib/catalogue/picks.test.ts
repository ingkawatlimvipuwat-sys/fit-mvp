import { describe, it, expect } from 'vitest';
import {
  normPick, isComplete, findDuplicate, versionLabel, resolveVersion,
  availableValues, valueOrder, clashesAfterRemoval,
  orderedValues, moveItem, usedValuesByPicker,
} from './picks';

const IDS = ['size', 'colour'];
const PICKERS = [{ id: 'size', name: 'Size', position: 0 }, { id: 'colour', name: 'Colour', position: 1 }];
const v = (id: string, picks: Record<string, string>, created_at = '2026-01-01T00:00:00Z') =>
  ({ id, picks, created_at });
const VERSIONS = [
  v('a', { size: 'L', colour: 'Black' }, '2026-01-01T00:00:01Z'),
  v('b', { size: 'L', colour: 'Green' }, '2026-01-01T00:00:02Z'),
  v('c', { size: 'M', colour: 'black ' }, '2026-01-01T00:00:03Z'),
];

describe('normPick', () => {
  it('trims and lowercases', () => expect(normPick(' Black ')).toBe('black'));
});

describe('isComplete', () => {
  it('needs a non-blank value for every picker', () => {
    expect(isComplete({ size: 'L', colour: 'Black' }, IDS)).toBe(true);
    expect(isComplete({ size: 'L' }, IDS)).toBe(false);
    expect(isComplete({ size: 'L', colour: '  ' }, IDS)).toBe(false);
  });
  it('a product with no pickers is always complete', () => expect(isComplete({}, [])).toBe(true));
});

describe('findDuplicate (rule 4)', () => {
  it('matches trimmed and case-insensitively', () => {
    expect(findDuplicate(VERSIONS, { size: 'm', colour: 'BLACK' }, IDS)?.id).toBe('c');
  });
  it('is null when something differs', () => {
    expect(findDuplicate(VERSIONS, { size: 'M', colour: 'Green' }, IDS)).toBe(null);
  });
  it('ignores the version being edited', () => {
    expect(findDuplicate(VERSIONS, { size: 'L', colour: 'Black' }, IDS, 'a')).toBe(null);
  });
  it('with no pickers, a second version always clashes', () => {
    expect(findDuplicate([v('a', {})], {}, [])?.id).toBe('a');
  });
});

describe('versionLabel', () => {
  it('joins picks in picker order', () => expect(versionLabel({ colour: 'Black', size: 'L' }, PICKERS)).toBe('L / Black'));
  it('skips blanks', () => expect(versionLabel({ size: 'L' }, PICKERS)).toBe('L'));
});

describe('resolveVersion', () => {
  it('finds the exact version once every picker is chosen', () => {
    expect(resolveVersion(VERSIONS, { size: 'L', colour: 'green' }, IDS)?.id).toBe('b');
  });
  it('is null for a partial selection', () => {
    expect(resolveVersion(VERSIONS, { size: 'L' }, IDS)).toBe(null);
  });
  it('is null when no such combination exists', () => {
    expect(resolveVersion(VERSIONS, { size: 'M', colour: 'Green' }, IDS)).toBe(null);
  });
  it('a single version with no pickers resolves with an empty selection', () => {
    expect(resolveVersion([v('a', {})], {}, [])?.id).toBe('a');
  });
});

describe('availableValues (grey-out)', () => {
  it('with nothing chosen, every used value is available', () => {
    expect([...availableValues(VERSIONS, IDS, {}, 'size')].sort()).toEqual(['l', 'm']);
  });
  it('colour options narrow to what exists for the chosen size', () => {
    expect([...availableValues(VERSIONS, IDS, { size: 'M' }, 'colour')]).toEqual(['black']);
    expect([...availableValues(VERSIONS, IDS, { size: 'L' }, 'colour')].sort()).toEqual(['black', 'green']);
  });
  it("a picker's own current choice does not narrow itself", () => {
    expect([...availableValues(VERSIONS, IDS, { size: 'M', colour: 'Black' }, 'size')].sort()).toEqual(['l', 'm']);
  });
  it('ignores incomplete versions', () => {
    const withPartial = [...VERSIONS, v('d', { size: 'XL' })];
    expect(availableValues(withPartial, IDS, {}, 'size').has('xl')).toBe(false);
  });
});

describe('valueOrder (first-used order, §4.5)', () => {
  it('orders by created_at and de-duplicates case-insensitively keeping the first spelling', () => {
    expect(valueOrder(VERSIONS, 'colour')).toEqual(['Black', 'Green']);
    expect(valueOrder([...VERSIONS].reverse(), 'size')).toEqual(['L', 'M']);
  });
});

describe('clashesAfterRemoval', () => {
  it('reports versions that would become identical', () => {
    const vs = [v('a', { size: 'L', colour: 'Black' }), v('b', { size: 'L', colour: 'Green' })];
    expect(clashesAfterRemoval(vs, IDS, 'colour').map(([x, y]) => [x.id, y.id])).toEqual([['a', 'b']]);
  });
  it('reports nothing when versions stay distinct', () => {
    const distinct = [v('a', { size: 'L', colour: 'x' }), v('b', { size: 'M', colour: 'x' })];
    expect(clashesAfterRemoval(distinct, IDS, 'colour')).toEqual([]);
  });
});

describe('orderedValues (Stage 3 value order)', () => {
  // first-used order of 'size' across these: S, M, L
  const SIZES = [
    v('1', { size: 'S' }, '2026-01-01T00:00:01Z'),
    v('2', { size: 'M' }, '2026-01-01T00:00:02Z'),
    v('3', { size: 'L' }, '2026-01-01T00:00:03Z'),
    v('4', { size: 'm ' }, '2026-01-01T00:00:04Z'),
  ];
  it('no stored order (empty, null or undefined) is exactly first-used order', () => {
    expect(orderedValues(SIZES, 'size', [])).toEqual(['S', 'M', 'L']);
    expect(orderedValues(SIZES, 'size', null)).toEqual(['S', 'M', 'L']);
    expect(orderedValues(SIZES, 'size')).toEqual(['S', 'M', 'L']);
  });
  it('follows the stored order', () => {
    expect(orderedValues(SIZES, 'size', ['L', 'M', 'S'])).toEqual(['L', 'M', 'S']);
  });
  it('puts values missing from the list after the listed ones, in first-used order', () => {
    expect(orderedValues(SIZES, 'size', ['L'])).toEqual(['L', 'S', 'M']);
  });
  it('ignores stale entries (no version uses them any more)', () => {
    expect(orderedValues(SIZES, 'size', ['XL', 'L', 'XS'])).toEqual(['L', 'S', 'M']);
  });
  it("matches trimmed and case-insensitively, showing the versions' own spelling", () => {
    expect(orderedValues(SIZES, 'size', [' l ', 'm'])).toEqual(['L', 'M', 'S']);
  });
  it('counts a repeated entry once', () => {
    expect(orderedValues(SIZES, 'size', ['M', 'm', 'S'])).toEqual(['M', 'S', 'L']);
  });
  it('ignores blank stored entries and blank picks', () => {
    const vs = [...SIZES, v('5', { size: '  ' }, '2026-01-01T00:00:05Z')];
    expect(orderedValues(vs, 'size', ['', 'L'])).toEqual(['L', 'S', 'M']);
  });
  it('only shows values of the versions it is given (the shopper page passes complete versions only)', () => {
    expect(orderedValues(SIZES.slice(0, 2), 'size', ['L', 'M', 'S'])).toEqual(['M', 'S']);
  });
  it('a picker no version uses has no values', () => {
    expect(orderedValues(SIZES, 'colour', ['Black'])).toEqual([]);
    expect(orderedValues([], 'size', ['S'])).toEqual([]);
  });
  it('a retyped pick ("M" → "XL") drops M and adds XL after the ordered values', () => {
    const retyped = SIZES.filter(x => x.id !== '2' && x.id !== '4').concat(v('2', { size: 'XL' }, '2026-01-01T00:00:02Z'));
    expect(orderedValues(retyped, 'size', ['L', 'M', 'S'])).toEqual(['L', 'S', 'XL']);
  });
});

describe('moveItem', () => {
  it('moves one step up or down', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
  });
  it('leaves the list unchanged at the edges and out of range', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 5, -1)).toEqual(['a', 'b']);
  });
  it('never mutates its input', () => {
    const list = ['a', 'b'];
    moveItem(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});

describe('usedValuesByPicker', () => {
  it("uses each picker's stored order", () => {
    const pickers = [{ id: 'size', name: 'Size', position: 0, value_order: ['M', 'L'] }, { id: 'colour', name: 'Colour', position: 1 }];
    expect(usedValuesByPicker(VERSIONS, pickers)).toEqual({ size: ['M', 'L'], colour: ['Black', 'Green'] });
  });
});
