import { describe, it, expect } from 'vitest';
import {
  normPick, isComplete, findDuplicate, versionLabel, resolveVersion,
  availableValues, valueOrder, clashesAfterRemoval,
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
