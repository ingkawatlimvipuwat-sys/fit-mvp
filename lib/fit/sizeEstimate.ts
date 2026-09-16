import type { DimensionKey } from '@/lib/config/dimensions';
import {
  getSizeChart, CHART_DIMS,
  type BodyProfile, type SizeCode, type SizeChartDim,
} from '@/lib/config/sizeChart';

const SIZES: SizeCode[] = ['S', 'M', 'L', 'XL']; // ascending; tie-break prefers earlier (smaller)

function isChartDim(key: DimensionKey): key is SizeChartDim {
  return (CHART_DIMS as string[]).includes(key);
}

function isUsable(v: number | undefined): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/**
 * Returns the given size's row, restricted to the dimensions this garment
 * actually has. length_cm / sleeve_cm are never in the chart, so never returned.
 */
export function fillFromSize(
  profile: BodyProfile,
  size: SizeCode,
  garmentDims: DimensionKey[],
): Partial<Record<DimensionKey, number>> {
  const row = getSizeChart()[profile][size];
  const out: Partial<Record<DimensionKey, number>> = {};
  for (const dim of garmentDims) {
    if (isChartDim(dim)) out[dim] = row[dim];
  }
  return out;
}

/**
 * Infers the nearest size from whatever body dimensions the customer already
 * entered, then returns chart values for the garment's chart dims that are
 * still blank. Never overwrites a value the customer provided.
 *
 * Scoring: sum of absolute differences across the usable known chart dims.
 * Tie-break: SIZES is ascending and we keep the first strict minimum, so an
 * exact tie resolves to the smaller size (avoids over-sizing).
 *
 * Returns null when there is no usable chart dim to match on.
 */
export function estimateFromPartial(
  profile: BodyProfile,
  known: Partial<Record<DimensionKey, number>>,
  garmentDims: DimensionKey[],
): { values: Partial<Record<DimensionKey, number>>; inferredSize: SizeCode } | null {
  const chart = getSizeChart()[profile];

  const scoreDims = CHART_DIMS.filter(d => isUsable(known[d]));
  if (scoreDims.length === 0) return null;

  let best: SizeCode = SIZES[0];
  let bestScore = Infinity;
  for (const size of SIZES) {
    const row = chart[size];
    let score = 0;
    for (const d of scoreDims) score += Math.abs((known[d] as number) - row[d]);
    if (score < bestScore) { bestScore = score; best = size; }
  }

  const row = chart[best];
  const values: Partial<Record<DimensionKey, number>> = {};
  for (const dim of garmentDims) {
    if (isChartDim(dim) && !isUsable(known[dim])) {
      values[dim] = row[dim];
    }
  }
  return { values, inferredSize: best };
}
