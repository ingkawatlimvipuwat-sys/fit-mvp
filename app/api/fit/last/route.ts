import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');
  const garment_id = url.searchParams.get('garment_id');
  if (!token) return NextResponse.json({ measurements: null });

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('fit_sessions')
    .select('customer_measurements, garment_id, created_at')
    .eq('customer_token', token)
    .order('created_at', { ascending: false })
    .limit(1);
  if (garment_id) query = query.eq('garment_id', garment_id);

  const { data } = await query;
  return NextResponse.json({ measurements: data?.[0]?.customer_measurements ?? null });
}
