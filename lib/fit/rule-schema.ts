import { z } from 'zod';
import { DIMENSIONS, dimensionByKey, type DimensionKey } from '@/lib/config/dimensions';
import { t } from '@/lib/i18n/strings';

const DIMENSION_KEYS = DIMENSIONS.map(d => d.key) as [DimensionKey, ...DimensionKey[]];

/**
 * Shared by the API routes and the client editor so the two cannot drift.
 *
 * The +/-30..50cm envelope is a typo net, not a physical limit — it catches a
 * `500` typed for `50`, which would otherwise silently make every garment fit.
 */
export const EaseRuleSchema = z
  .object({
    tightBelow: z.number().min(-30).max(50),
    goodFrom: z.number().min(-30).max(50),
    goodTo: z.number().min(-30).max(50),
  })
  // Equality allowed: it simply means "no snug zone".
  .refine(r => r.tightBelow <= r.goodFrom, {
    message: 'fitRuleOrderGoodFrom',
    path: ['goodFrom'],
  })
  // Strict: equality would make good_fit unreachable.
  .refine(r => r.goodFrom < r.goodTo, {
    message: 'fitRuleOrderGoodTo',
    path: ['goodTo'],
  });

export const FitRulesetSchema = z
  .object({
    base: EaseRuleSchema.optional(),
    perDimension: z
      .object(
        Object.fromEntries(DIMENSION_KEYS.map(k => [k, EaseRuleSchema.optional()])) as Record<
          DimensionKey,
          z.ZodOptional<typeof EaseRuleSchema>
        >
      )
      .strict()
      .default({}),
  })
  .strict();

export const RulesetNameSchema = z.string().trim().min(1).max(60);

const RULE_MESSAGE_KEYS = ['fitRuleOrderGoodFrom', 'fitRuleOrderGoodTo'] as const;
type RuleMessageKey = (typeof RULE_MESSAGE_KEYS)[number];
const isRuleMessageKey = (m: string): m is RuleMessageKey =>
  (RULE_MESSAGE_KEYS as readonly string[]).includes(m);

/**
 * A rule-validation failure as text for the given language. Our own refine
 * messages are string keys mapped through strings.ts; every other zod issue
 * (range, type, unknown key) becomes the generic fitRuleInvalid, so zod's
 * English never reaches a user. A per-dimension issue names the dimension by
 * its label, never by its raw key.
 */
export function ruleIssueMessage(err: z.ZodError, lang: 'th' | 'en'): string {
  const issue = err.issues[0];
  if (!issue) return t.fitRuleInvalid[lang];
  const text = issue.code === 'custom' && isRuleMessageKey(issue.message)
    ? t[issue.message][lang]
    : t.fitRuleInvalid[lang];
  const dimKey = issue.path[0] === 'perDimension' ? issue.path[1] : undefined;
  const dim = typeof dimKey === 'string' ? dimensionByKey(dimKey) : undefined;
  return dim ? `${text} (${lang === 'th' ? dim.labelTh : dim.labelEn})` : text;
}

/** First human-readable message from a failed parse, for a 400 body (Thai). */
export function firstIssueMessage(err: z.ZodError): string {
  return ruleIssueMessage(err, 'th');
}
