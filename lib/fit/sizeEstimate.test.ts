import { describe, it, expect } from 'vitest';
import { fillFromSize, estimateFromPartial } from './sizeEstimate';
import type { DimensionKey } from '@/lib/config/dimensions';

const TOP: DimensionKey[] = ['shoulder_cm', 'chest_cm', 'waist_cm', 'sleeve_cm', 'length_cm'];
const SLEEVELESS: DimensionKey[] = ['shoulder_cm', 'chest_cm', 'waist_cm', 'length_cm'];

describe('fillFromSize', () => {
  it('returns the chosen row, intersected with the garment dimensions', () => {
    expect(fillFromSize('women', 'M', TOP)).toEqual({
      shoulder_cm: 37, chest_cm: 87, waist_cm: 69,
    });
  });

  it('never returns length or sleeve even when the garment has them', () => {
    const out = fillFromSize('men', 'L', TOP);
    expect(out.length_cm).toBeUndefined();
    expect(out.sleeve_cm).toBeUndefined();
  });

  it('omits body dims the garment does not have', () => {
    const out = fillFromSize('women', 'S', SLEEVELESS);
    expect(out.hip_cm).toBeUndefined(); // SLEEVELESS has no hip
    expect(out.shoulder_cm).toBe(36);
  });
});

describe('estimateFromPartial', () => {
  it('infers the nearest size from a known body dim and fills the blanks', () => {
    // women waist 70 is closest to M (69); fills chest+shoulder, leaves waist as given
    const res = estimateFromPartial('women', { waist_cm: 70 }, TOP);
    expect(res).not.toBeNull();
    expect(res!.inferredSize).toBe('M');
    expect(res!.values).toEqual({ shoulder_cm: 37, chest_cm: 87 });
  });

  it('never overwrites a value the customer already entered', () => {
    const res = estimateFromPartial('women', { chest_cm: 999, waist_cm: 74 }, TOP);
    expect(res!.values.chest_cm).toBeUndefined(); // chest was provided, so not filled
  });

  it('only fills body dims present on the garment', () => {
    const res = estimateFromPartial('women', { waist_cm: 70 }, SLEEVELESS);
    expect(res!.values.hip_cm).toBeUndefined(); // SLEEVELESS has no hip
  });

  it('returns null when nothing usable was entered', () => {
    // length/sleeve are not chart dims, so there is nothing to match on
    expect(estimateFromPartial('women', { length_cm: 60, sleeve_cm: 55 }, TOP)).toBeNull();
    expect(estimateFromPartial('women', {}, TOP)).toBeNull();
  });

  it('breaks an exact tie toward the smaller size', () => {
    // women waist midway between S(64) and M(69) is 66.5; equal distance → S wins
    const res = estimateFromPartial('women', { waist_cm: 66.5 }, TOP);
    expect(res!.inferredSize).toBe('S');
  });

  it('ignores non-positive or non-finite known values when scoring', () => {
    const res = estimateFromPartial('women', { waist_cm: 0, chest_cm: 92 }, TOP);
    expect(res!.inferredSize).toBe('L'); // chest 92 == L; waist 0 ignored
  });
});
