import type { EaseRule } from '@/lib/fit/rules';

/** Widths of the four zones and the dot position, all in percent of the bar. */
export interface EaseBar {
  tight: number;
  snug: number;
  good: number;
  loose: number;
  dot: number;
}

/** Keeps the dot fully inside the bar when the ease is far off either end. */
const DOT_MIN = 3;
const DOT_MAX = 97;

/**
 * Geometry for the tight-to-loose bar. Drawn in EASE (garment minus body), the
 * direction the retailer sets rules in — the engine's `diff` is the negation.
 *
 * The bar runs from a little below `tightBelow` to a little above `goodTo`, so
 * the tight and loose zones are always visible and the rule's own bands take
 * their true proportions in between. Presentation only: the verdict comes from
 * the engine, never from where the dot lands.
 */
export function easeBar(ease: number, rule: EaseRule): EaseBar {
  const span = Math.max(rule.goodTo - rule.tightBelow, 1);
  const pad = Math.max(span * 0.4, 2);
  const lo = rule.tightBelow - pad;
  const total = span + pad * 2;
  const pct = (cm: number) => (cm / total) * 100;
  const snug = pct(Math.max(rule.goodFrom - rule.tightBelow, 0));
  const good = pct(Math.max(rule.goodTo - rule.goodFrom, 0));
  const tight = pct(pad);
  return {
    tight,
    snug,
    good,
    loose: 100 - tight - snug - good,
    dot: Math.min(DOT_MAX, Math.max(DOT_MIN, pct(ease - lo))),
  };
}
