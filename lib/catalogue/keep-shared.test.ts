import { describe, it, expect } from 'vitest';
import { keepSharedValues } from './keep-shared';

describe('keepSharedValues', () => {
  it('keeps values for dimensions the new garment also asks for', () => {
    expect(keepSharedValues({ chest_cm: '100', waist_cm: '80' }, ['chest_cm', 'length_cm']))
      .toEqual({ chest_cm: '100' });
  });
  it('returns an empty object when nothing is shared', () => {
    expect(keepSharedValues({ chest_cm: '100' }, ['hip_cm'])).toEqual({});
  });
});
