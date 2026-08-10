import type { EaseRule, FitRuleset } from '@/lib/fit/rules';

/**
 * A built-in profile is now just a named FitRuleset. `regular` carries an empty
 * ruleset so every dimension falls through to its own default — see the comment
 * on FitRuleset.base for why that matters.
 */
export interface FitProfile {
  key: string;
  labelTh: string;
  labelEn: string;
  ruleset: FitRuleset;
}

/** Slim: acceptable ease shrinks to 1-3cm. */
const SLIM: EaseRule = { tightBelow: -1, goodFrom: 1, goodTo: 3 };
/** Relaxed: acceptable ease extends to 1-8cm. */
const RELAXED: EaseRule = { tightBelow: -1, goodFrom: 1, goodTo: 8 };

export const FIT_PROFILES: FitProfile[] = [
  {
    key: 'regular', labelTh: 'ทรงปกติ', labelEn: 'Regular',
    ruleset: { perDimension: {} },
  },
  {
    key: 'slim', labelTh: 'ทรงเข้ารูป', labelEn: 'Slim',
    ruleset: {
      perDimension: {
        shoulder_cm: SLIM, chest_cm: SLIM, waist_cm: SLIM, hip_cm: SLIM,
      },
    },
  },
  {
    key: 'relaxed', labelTh: 'ทรงหลวม', labelEn: 'Relaxed',
    ruleset: {
      perDimension: {
        shoulder_cm: RELAXED, chest_cm: RELAXED, waist_cm: RELAXED, hip_cm: RELAXED,
      },
    },
  },
];

/**
 * Label/metadata lookup for the dashboard. Falls back to `regular` for an
 * unrecognised key, preserving pre-change behaviour. The ruleset-resolution
 * path uses `builtinRuleset()` in lib/fit/resolve.ts, which wraps this.
 */
export function fitProfileByKey(key: string): FitProfile {
  return FIT_PROFILES.find(p => p.key === key) ?? FIT_PROFILES[0]!;
}
