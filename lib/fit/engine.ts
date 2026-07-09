import { DIMENSIONS, type DimensionKey, type ThresholdBand } from '@/lib/config/dimensions';
import { fitProfileByKey } from '@/lib/config/fit-profiles';
import type { MeasurementBag } from '@/lib/supabase/types';

export type Verdict = 'too_tight' | 'snug' | 'good_fit' | 'loose' | 'unknown';

export interface DimensionResult {
  verdict: Verdict;
  customer: number | null;
  garment: number | null;
  diff: number | null;     // customer - garment, or null if unknown
}

export interface FitResult {
  dimensions: Partial<Record<DimensionKey, DimensionResult>>;
  overall: Verdict;
}

const SEVERITY: Record<Verdict, number> = {
  too_tight: 4, loose: 3, snug: 2, good_fit: 1, unknown: 0,
};

function matchBand(diff: number, bands: readonly ThresholdBand[]): Verdict {
  for (const b of bands) {
    if (diff >= b.min && diff < b.max) return b.verdict;
  }
  // Safety net: should never reach here if bands cover -∞..+∞
  return 'unknown';
}

export function evaluateFit(
  garment: MeasurementBag,
  customer: MeasurementBag,
  fitProfileKey: string
): FitResult {
  const profile = fitProfileByKey(fitProfileKey);
  const result: FitResult = { dimensions: {}, overall: 'unknown' };
  let worstScored: Verdict | null = null;

  for (const dim of DIMENSIONS) {
    const g = garment[dim.key];
    const c = customer[dim.key];
    if (g === undefined || c === undefined) {
      result.dimensions[dim.key] = { verdict: 'unknown', customer: c ?? null, garment: g ?? null, diff: null };
      continue;
    }
    const bands = profile.overrides[dim.key] ?? dim.defaultBands;
    const diff = c - g;
    const verdict = matchBand(diff, bands);
    result.dimensions[dim.key] = { verdict, customer: c, garment: g, diff };
    if (worstScored === null || SEVERITY[verdict] > SEVERITY[worstScored]) {
      worstScored = verdict;
    }
  }

  result.overall = worstScored ?? 'unknown';
  return result;
}
