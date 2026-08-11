import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { evaluateFit } from '@/lib/fit/engine';
import { DIMENSIONS, type DimensionKey } from '@/lib/config/dimensions';
import type { MeasurementBag } from '@/lib/supabase/types';
import { resolveRuleset } from '@/lib/fit/resolve';

const Body = z.object({
  garment_id: z.string().uuid(),
  customer_token: z.string().optional(),
  customer_measurements: z.record(z.string(), z.number().positive().max(300)),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
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

  const { error: insErr } = await supabase.from('fit_sessions').insert({
    garment_id,
    customer_token: customer_token ?? null,
    customer_measurements: cleanCustomer,
    result,
    // Snapshot of the rule that produced `result`. Append-only: rules are
    // editable, so without this the verdict becomes uninterpretable the moment
    // a retailer edits the preset.
    applied_rule: ruleset,
  });
  if (insErr) console.error('fit_sessions insert failed (non-fatal):', insErr.message);

  return NextResponse.json({ result });
}
