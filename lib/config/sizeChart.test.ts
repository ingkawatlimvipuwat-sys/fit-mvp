import { describe, it, expect } from 'vitest';
import { getSizeChart, CHART_DIMS, type BodyProfile, type SizeCode } from './sizeChart';

const PROFILES: BodyProfile[] = ['women', 'men'];
const SIZES: SizeCode[] = ['S', 'M', 'L', 'XL'];

describe('getSizeChart default data', () => {
  it('has every chart dimension for every profile and size', () => {
    const chart = getSizeChart();
    for (const p of PROFILES) {
      for (const s of SIZES) {
        const row = chart[p][s];
        for (const d of CHART_DIMS) {
          expect(typeof row[d]).toBe('number');
          expect(row[d]).toBeGreaterThan(0);
        }
      }
    }
  });

  it('increases monotonically S < M < L < XL on every dimension', () => {
    const chart = getSizeChart();
    for (const p of PROFILES) {
      for (const d of CHART_DIMS) {
        const seq = SIZES.map(s => chart[p][s][d]);
        for (let i = 1; i < seq.length; i++) {
          expect(seq[i]).toBeGreaterThan(seq[i - 1]);
        }
      }
    }
  });

  it('does not carry length or sleeve columns', () => {
    const row = getSizeChart().women.M as Record<string, unknown>;
    expect(row.length_cm).toBeUndefined();
    expect(row.sleeve_cm).toBeUndefined();
  });
});
