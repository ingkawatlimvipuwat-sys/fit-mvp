import type { DimensionKey, ThresholdBand } from '@/lib/config/dimensions';

/**
 * A fit rule expressed in EASE — how many cm roomier the garment is than the
 * body (`garment - customer`). This is the retailer-facing orientation; the
 * engine works on the negation (`diff = customer - garment`).
 *
 * Negative ease means the garment measures SMALLER than the body, which is how
 * a stretchy fabric is expressed. That is why there is no separate stretch flag.
 */
export interface EaseRule {
  tightBelow: number;  // ease <= this            -> too_tight
  goodFrom: number;    // tightBelow < ease <= me -> snug
  goodTo: number;      // goodFrom  < ease <= me  -> good_fit;  above -> loose
}

/**
 * A base rule plus per-dimension exceptions. `base` is optional so the built-in
 * `regular` profile can be `{ perDimension: {} }` and fall through to each
 * dimension's own default — which keeps a future dimension with a different
 * default from being silently overridden.
 */
export interface FitRuleset {
  base?: EaseRule;
  perDimension: Partial<Record<DimensionKey, EaseRule>>;
}

/** Today's behaviour, unchanged: good fit is 1-5cm of room. */
export const DEFAULT_RULE: EaseRule = { tightBelow: -1, goodFrom: 1, goodTo: 5 };

const INF = Number.POSITIVE_INFINITY;

/**
 * Compile an ease rule to the engine's diff-oriented bands.
 *
 * Note the inclusivity flip: ease bounds are inclusive-UPPER, engine bands are
 * `[min, max)`. Negating swaps the open end so the two agree. If
 * `tightBelow === goodFrom` the snug band is empty (min === max never matches)
 * — harmless and intentional.
 */
export function easeRuleToBands(r: EaseRule): ThresholdBand[] {
  return [
    { min: -r.tightBelow, max: INF,           verdict: 'too_tight' },
    { min: -r.goodFrom,   max: -r.tightBelow, verdict: 'snug' },
    { min: -r.goodTo,     max: -r.goodFrom,   verdict: 'good_fit' },
    { min: -INF,          max: -r.goodTo,     verdict: 'loose' },
  ];
}
