import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { parsePickerName } from '@/lib/catalogue/parse';
import { clashesAfterRemoval, orderedValues, versionLabel } from '@/lib/catalogue/picks';
import { t } from '@/lib/i18n/strings';

type Params = { params: Promise<{ id: string; pickerId: string }> };

const PatchBody = z.object({
  name: z.string().optional(),
  /** The picker's values in the order the owner wants shoppers to see them. */
  value_order: z.array(z.string().max(60)).max(500).optional(),
}).strict();

const badIds = (p: { id: string; pickerId: string }) =>
  !z.uuid().safeParse(p.id).success || !z.uuid().safeParse(p.pickerId).success;

/**
 * Rename a picker and/or set the order of its values. Body: { name?, value_order? }.
 * Picks are keyed by picker id, so a rename touches one row only. The stored
 * order is recomputed from the product's current versions (orderedValues):
 * stale entries are dropped, unknown strings ignored, and a value added since
 * the page loaded is kept at the end — so a stale page can never lose a value.
 */
export async function PATCH(req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (badIds(params)) return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

  const body = PatchBody.safeParse(await req.json().catch(() => null));
  if (!body.success || (body.data.name === undefined && body.data.value_order === undefined)) {
    return NextResponse.json({ error: t.requestInvalid.th }, { status: 400 });
  }
  const update: { name?: string; value_order?: string[] } = {};
  if (body.data.name !== undefined) {
    const name = parsePickerName(body.data.name);
    if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
    update.name = name.value;
  }

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  if (!found.ctx.pickers.some(p => p.id === params.pickerId)) {
    return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });
  }
  if (body.data.value_order !== undefined) {
    update.value_order = orderedValues(found.ctx.versions, params.pickerId, body.data.value_order);
  }

  const { error } = await supabase
    .from('product_pickers').update(update)
    .eq('id', params.pickerId).eq('product_id', params.id);
  if (error) {
    console.error('picker update failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true, value_order: update.value_order });
}

/**
 * Remove a picker and its key from every version's picks. Refused with 409 when
 * that would make two versions identical (rule 4), naming them.
 */
export async function DELETE(_req: Request, props: Params) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });
  if (badIds(params)) return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });
  const { ctx } = found;
  if (!ctx.pickers.some(p => p.id === params.pickerId)) {
    return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });
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
