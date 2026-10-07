import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { parsePickerName } from '@/lib/catalogue/parse';
import { nextPosition, parseBackfill, planAddPicker } from '@/lib/catalogue/picker-ops';
import { t } from '@/lib/i18n/strings';

/**
 * Add a picker. Body: { name, values?: { [versionId]: value } }. The values are
 * the existing versions' picks for it, asked for in the same step so no live
 * version drops off the shopper page (spec §5.2).
 */
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = parsePickerName(body?.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const { ctx } = found;

  const backfill = parseBackfill(body?.values, ctx.versions.map(v => v.id));
  if (!backfill.ok) return NextResponse.json({ error: backfill.error }, { status: 400 });

  const { data: picker, error } = await supabase
    .from('product_pickers')
    .insert({ product_id: params.id, name: name.value, position: nextPosition(ctx.pickers) })
    .select('id')
    .single();
  if (error || !picker) {
    console.error('picker insert failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  const plan = planAddPicker(ctx, picker.id, backfill.values);
  if (!plan.ok) {
    await supabase.from('product_pickers').delete().eq('id', picker.id).eq('product_id', params.id);
    return NextResponse.json({ error: plan.error }, { status: 400 });
  }

  for (const u of plan.updates) {
    const { error: upErr } = await supabase
      .from('garments').update({ picks: u.picks }).eq('id', u.id).eq('retailer_id', user.id);
    if (upErr) {
      // The picker exists; a version just lacks its value and shows ⚠ "missing a pick".
      console.error('pick backfill failed:', upErr);
      return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true, id: picker.id });
}
