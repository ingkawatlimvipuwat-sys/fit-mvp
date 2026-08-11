import { z } from 'zod';
import { DIMENSIONS, type DimensionKey } from '@/lib/config/dimensions';

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
    message: 'ค่า "พอดีตั้งแต่" ต้องไม่น้อยกว่าค่า "แน่นเกินไป"',
    path: ['goodFrom'],
  })
  // Strict: equality would make good_fit unreachable.
  .refine(r => r.goodFrom < r.goodTo, {
    message: 'ค่า "ถึง" ต้องมากกว่าค่า "พอดีตั้งแต่"',
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

/** First human-readable message from a failed parse, for a 400 body. */
export function firstIssueMessage(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง';
}
