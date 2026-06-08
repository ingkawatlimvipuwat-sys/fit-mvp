import type { ThresholdBand, DimensionKey } from './dimensions';

/**
 * A profile is an OPTIONAL per-dimension override map. Missing keys mean
 * "use the dimension's default bands". Bands are full replacements, not deltas.
 */
export interface FitProfile {
  key: string;
  labelTh: string;
  labelEn: string;
  overrides: Partial<Record<DimensionKey, ThresholdBand[]>>;
}

const INF = Number.POSITIVE_INFINITY;

/** Slim: tighten "good fit" by 2cm — i.e. acceptable ease shrinks to 0..3cm. */
const SLIM_DEFAULT: ThresholdBand[] = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -3,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -3,  verdict: 'loose' },
];

/** Relaxed: widen "good fit" by 3cm — acceptable ease extends to 1..8cm. */
const RELAXED_DEFAULT: ThresholdBand[] = [
  { min: 1,    max: INF, verdict: 'too_tight' },
  { min: -1,   max: 1,   verdict: 'snug' },
  { min: -8,   max: -1,  verdict: 'good_fit' },
  { min: -INF, max: -8,  verdict: 'loose' },
];

export const FIT_PROFILES: FitProfile[] = [
  { key: 'regular', labelTh: 'ทรงปกติ',  labelEn: 'Regular', overrides: {} },
  {
    key: 'slim', labelTh: 'ทรงเข้ารูป', labelEn: 'Slim',
    overrides: {
      shoulder_cm: SLIM_DEFAULT, chest_cm: SLIM_DEFAULT,
      waist_cm: SLIM_DEFAULT, hip_cm: SLIM_DEFAULT,
    },
  },
  {
    key: 'relaxed', labelTh: 'ทรงหลวม', labelEn: 'Relaxed',
    overrides: {
      shoulder_cm: RELAXED_DEFAULT, chest_cm: RELAXED_DEFAULT,
      waist_cm: RELAXED_DEFAULT, hip_cm: RELAXED_DEFAULT,
    },
  },
];

export function fitProfileByKey(key: string): FitProfile {
  return FIT_PROFILES.find(p => p.key === key) ?? FIT_PROFILES[0]!;
}
