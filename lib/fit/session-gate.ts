import type { SupabaseClient } from '@supabase/supabase-js';
import type { MeasurementBag } from '@/lib/supabase/types';

export const EVALUATE_PER_IP_PER_MINUTE = 30;
export const SESSION_WRITE_WINDOW_MS = 10 * 60_000;
export const SESSION_WRITE_CAP = 120;           // rows per shop per window
export const DUPLICATE_WINDOW_MS = 10 * 60_000;

export type WriteDecision = 'insert' | 'skip_duplicate' | 'skip_cap';

const TOKEN_RE = /^[A-Za-z0-9-]{1,64}$/;

/** A token we are willing to store: 1–64 of [A-Za-z0-9-] after trimming, else null. */
export function normaliseCustomerToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const token = raw.trim();
  return TOKEN_RE.test(token) ? token : null;
}

/** Same keys and same numbers. `stored` comes from the database, so it is checked, not trusted. */
export function sameMeasurements(a: MeasurementBag, stored: unknown): boolean {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return false;
  const b = stored as Record<string, unknown>;
  const aRec = a as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every(k => Object.prototype.hasOwnProperty.call(b, k) && b[k] === aRec[k]);
}

/**
 * How many sessions this shop's garments have saved since `since`. `fit_sessions` has no
 * retailer column, so the shop comes through the garment. `!inner` is what makes the
 * filter narrow the rows: without it PostgREST keeps every session and the count is
 * silently the whole app again.
 */
export function countRecentShopSessions(supabase: SupabaseClient, retailerId: string, since: string) {
  return supabase.from('fit_sessions')
    .select('id, garments!inner(retailer_id)', { count: 'exact', head: true })
    .eq('garments.retailer_id', retailerId)
    .gte('created_at', since);
}

/**
 * recentCount: this shop's rows in the last SESSION_WRITE_WINDOW_MS, or null if the count failed (fail open).
 * last: this token's latest session for this garment, or null (none, no token, or the read failed).
 */
export function decideSessionWrite(input: {
  recentCount: number | null;
  last: { customer_measurements: unknown; created_at: string } | null;
  measurements: MeasurementBag;
  now: number;
}): WriteDecision {
  const { recentCount, last, measurements, now } = input;
  if (last && sameMeasurements(measurements, last.customer_measurements)) {
    const at = Date.parse(last.created_at);
    if (Number.isFinite(at) && now - at < DUPLICATE_WINDOW_MS) return 'skip_duplicate';
  }
  if (recentCount !== null && recentCount >= SESSION_WRITE_CAP) return 'skip_cap';
  return 'insert';
}
