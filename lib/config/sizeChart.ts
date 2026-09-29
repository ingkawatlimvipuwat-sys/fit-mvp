/**
 * Built-in body size chart used by the fit form's "not sure of your
 * measurements?" helper.
 *
 * PROVENANCE: best-estimate Thai adult body averages, captured 2026-09.
 * These numbers are PROVISIONAL — refine them here (single source) when real
 * fit data lands. This is the only place the default numbers live.
 *
 * Only carries body dimensions that scale with size (shoulder/chest/waist/hip).
 * length_cm and sleeve_cm are garment-cut / length-preference numbers, not body
 * attributes, so the chart deliberately omits them.
 *
 * Keyed by BodyProfile (not raw gender) so non-adult profiles (teen/kids) are
 * additive later without restructuring — see spec §10.
 */

export type BodyProfile = 'women' | 'men'; // future: 'teen_women' | 'teen_men' | 'kids' | ...
export type SizeCode = 'S' | 'M' | 'L' | 'XL'; // adult codes; a future kids profile may use age bands
export type SizeChartDim = 'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm';

export type SizeRow = Record<SizeChartDim, number>;
export type SizeChart = Record<BodyProfile, Record<SizeCode, SizeRow>>;

/** The body dimensions the chart can fill. Never length_cm / sleeve_cm. */
export const CHART_DIMS: SizeChartDim[] = ['shoulder_cm', 'chest_cm', 'waist_cm', 'hip_cm'];

const DEFAULT_CHART: SizeChart = {
  women: {
    S:  { shoulder_cm: 36,   chest_cm: 82, waist_cm: 64, hip_cm: 88 },
    M:  { shoulder_cm: 37,   chest_cm: 87, waist_cm: 69, hip_cm: 93 },
    L:  { shoulder_cm: 38,   chest_cm: 92, waist_cm: 74, hip_cm: 98 },
    XL: { shoulder_cm: 39.5, chest_cm: 98, waist_cm: 80, hip_cm: 104 },
  },
  men: {
    S:  { shoulder_cm: 42, chest_cm: 90,  waist_cm: 76, hip_cm: 90 },
    M:  { shoulder_cm: 44, chest_cm: 96,  waist_cm: 82, hip_cm: 95 },
    L:  { shoulder_cm: 46, chest_cm: 102, waist_cm: 88, hip_cm: 100 },
    XL: { shoulder_cm: 47, chest_cm: 108, waist_cm: 94, hip_cm: 105 },
  },
};

/**
 * Single read point for the size chart. Today it returns the built-in default.
 * Phase-2 seam: a per-shop override (JSON on the shop row) will merge over the
 * default here, without any customer-side rework.
 */
export function getSizeChart(): SizeChart {
  return DEFAULT_CHART;
}
