import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { evaluateFit } from '@/lib/fit/engine';
import { DIMENSIONS, type DimensionKey } from '@/lib/config/dimensions';
import type { MeasurementBag } from '@/lib/supabase/types';

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
    .select('measurements, fit_profile')
    .eq('id', garment_id)
    .single();
  if (gErr || !garment) return NextResponse.json({ error: 'garment not found' }, { status: 404 });

  const result = evaluateFit(garment.measurements as MeasurementBag, cleanCustomer, garment.fit_profile);

  const { error: insErr } = await supabase.from('fit_sessions').insert({
    garment_id,
    customer_token: customer_token ?? null,
    customer_measurements: cleanCustomer,
    result,
  });
  if (insErr) console.error('fit_sessions insert failed (non-fatal):', insErr.message);

  return NextResponse.json({ result });
}
