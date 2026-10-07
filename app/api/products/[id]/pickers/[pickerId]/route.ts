import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { parsePickerName } from '@/lib/catalogue/parse';
import { clashesAfterRemoval, versionLabel } from '@/lib/catalogue/picks';
import { t } from '@/lib/i18n/strings';

type Params = { params: Promise<{ id: string; pickerId: string }> };

/** Rename a picker. Picks are keyed by picker id, so this touches one row only. */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = parsePickerName(body?.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.ctx.pickers.some(p => p.id === params.pickerId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('product_pickers').update({ name: name.value })
    .eq('id', params.pickerId).eq('product_id', params.id);
  if (error) {
    console.error('picker rename failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Remove a picker and its key from every version's picks. Refused with 409 when
 * that would make two versions identical (rule 4), naming them.
 */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const { ctx } = found;
  if (!ctx.pickers.some(p => p.id === params.pickerId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const clashes = clashesAfterRemoval(ctx.versions, ctx.pickers.map(p => p.id), params.pickerId);
  if (clashes.length > 0) {
    const [a, b] = clashes[0];
    return NextResponse.json({
      error: t.removePickerClash.th
        .replace('{a}', versionLabel(a.picks, ctx.pickers))
        .replace('{b}', versionLabel(b.picks, ctx.pickers)),
    }, { status: 409 });
  }

  const { error } = await supabase
    .from('product_pickers').delete().eq('id', params.pickerId).eq('product_id', params.id);
  if (error) {
    console.error('picker delete failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  for (const v of ctx.versions) {
    if (!(params.pickerId in v.picks)) continue;
    const rest = { ...v.picks };
    delete rest[params.pickerId];
    const { error: upErr } = await supabase
      .from('garments').update({ picks: rest }).eq('id', v.id).eq('retailer_id', user.id);
    if (upErr) console.error('pick strip failed (non-fatal):', upErr);
  }
  return NextResponse.json({ ok: true });
}
