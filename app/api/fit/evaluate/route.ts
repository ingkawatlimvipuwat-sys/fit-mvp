import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { evaluateFit } from '@/lib/fit/engine';
import { DIMENSIONS, type DimensionKey } from '@/lib/config/dimensions';
import type { MeasurementBag } from '@/lib/supabase/types';
import { resolveRuleset } from '@/lib/fit/resolve';
import { t } from '@/lib/i18n/strings';
import { createFixedWindowLimiter, clientIpFrom } from '@/lib/rate-limit';
import {
  EVALUATE_PER_IP_PER_MINUTE, SESSION_WRITE_WINDOW_MS, decideSessionWrite, normaliseCustomerToken,
} from '@/lib/fit/session-gate';

// Per server instance only (see lib/rate-limit.ts): a speed bump, not a guarantee.
const ipLimiter = createFixedWindowLimiter({ limit: EVALUATE_PER_IP_PER_MINUTE, windowMs: 60_000 });

const Body = z.object({
  garment_id: z.string().uuid(),
  // Normalised, not rejected, so an odd old token never breaks a shopper's check.
  customer_token: z.string().optional(),
  customer_measurements: z.record(z.string(), z.number().positive().max(300)),
}).strict();

export async function POST(req: Request) {
  const limit = ipLimiter.hit(clientIpFrom(req.headers));
  if (!limit.allowed) {
    return NextResponse.json(
      { error: t.fitTooManyChecks.th, code: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } },
    );
  }

  // Malformed JSON becomes null, which the schema rejects as a 400 rather than a 500.
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { garment_id, customer_token, customer_measurements } = parsed.data;

  // Whitelist measurement keys to known dimensions only
  const validKeys = new Set(DIMENSIONS.map(d => d.key));
  const cleanCustomer: MeasurementBag = {};
  for (const [k, v] of Object.entries(customer_measurements)) {
    if (validKeys.has(k as DimensionKey)) (cleanCustomer as Record<string, number>)[k] = v;
  }

  const supabase = createSupabaseAdminClient();
  const { data: garment, error: gErr } = await supabase
    .from('garments')
    .select('measurements, fit_profile, fit_ruleset_id, fit_rule_override')
    .eq('id', garment_id)
    .single();
  if (gErr || !garment) return NextResponse.json({ error: 'garment not found' }, { status: 404 });

  // One extra query at most, skipped entirely when the garment has an inline
  // override or uses a built-in profile.
  let presetRule: unknown = null;
  if (garment.fit_ruleset_id && garment.fit_rule_override == null) {
    const { data: preset, error: pErr } = await supabase
      .from('fit_rulesets')
      .select('rule')
      .eq('id', garment.fit_ruleset_id)
      .single();
    if (pErr || !preset) {
      // A deleted or unreadable preset must not break the customer-facing
      // checker — resolveRuleset falls back to the garment's fit_profile.
      console.error('fit_ruleset fetch failed; falling back to fit_profile:', pErr?.message);
    } else {
      presetRule = preset.rule;
    }
  }

  const ruleset = resolveRuleset(garment, presetRule);
  const result = evaluateFit(garment.measurements as MeasurementBag, cleanCustomer, ruleset);

  // Write gates (see lib/fit/session-gate.ts). The shopper always gets the
  // verdict; these only decide whether a fit_sessions row is saved. Every gate
  // fails open: a broken gate must never break the fit checker.
  const token = normaliseCustomerToken(customer_token);
  const now = Date.now();
  const since = new Date(now - SESSION_WRITE_WINDOW_MS).toISOString();
  const [countRes, lastRes] = await Promise.all([
    supabase.from('fit_sessions').select('id', { count: 'exact', head: true }).gte('created_at', since),
    token
      ? supabase.from('fit_sessions')
          .select('customer_measurements, created_at')
          .eq('customer_token', token).eq('garment_id', garment_id)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (countRes.error) console.error('fit_sessions count failed; not capping:', countRes.error.message);
  if (lastRes.error) console.error('fit_sessions last-session read failed; not de-duplicating:', lastRes.error.message);

  const decision = decideSessionWrite({
    recentCount: countRes.error ? null : (countRes.count ?? null),
    last: lastRes.error ? null : (lastRes.data ?? null),
    measurements: cleanCustomer,
    now,
  });
  if (decision === 'insert') {
    const { error: insErr } = await supabase.from('fit_sessions').insert({
      garment_id,
      customer_token: token,
      customer_measurements: cleanCustomer,
      result,
      // Snapshot of the rule that produced `result`. Append-only: rules are
      // editable, so without this the verdict becomes uninterpretable the moment
      // a retailer edits the preset.
      applied_rule: ruleset,
    });
    if (insErr) console.error('fit_sessions insert failed (non-fatal):', insErr.message);
  } else if (decision === 'skip_cap') {
    console.warn('fit_sessions write cap reached; verdict returned without saving');
  }

  return NextResponse.json({ result });
}
