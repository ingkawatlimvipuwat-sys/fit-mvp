import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { parseProductName } from '@/lib/catalogue/parse';
import { removeStoredPhoto } from '@/lib/garment/storage-cleanup';
import { t } from '@/lib/i18n/strings';

/** Rename. Versions' own stored garments.name is deliberately not synced (spec §4.2). */
export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = parseProductName(body?.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });

  const { error } = await supabase
    .from('products').update({ name: name.value }).eq('id', params.id).eq('retailer_id', user.id);
  if (error) {
    console.error('product rename failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Delete a product, all its versions and their stored photos (rule 7). The client confirms first. */
export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) return NextResponse.json({ error: found.error }, { status: found.status });

  // Read the photo urls BEFORE deleting: the cascade destroys the rows that name them.
  const ids = found.ctx.versions.map(v => v.id);
  const urls: (string | null)[] = [];
  if (ids.length > 0) {
    const [{ data: garments }, { data: fabrics }] = await Promise.all([
      supabase.from('garments').select('photo_url, true_colour_photo_url')
        .eq('product_id', params.id).eq('retailer_id', user.id),
      supabase.from('garment_fabric').select('fabric_photo_url').in('garment_id', ids),
    ]);
    for (const g of garments ?? []) urls.push(g.photo_url, g.true_colour_photo_url);
    for (const f of fabrics ?? []) urls.push(f.fabric_photo_url);
  }

  const { error } = await supabase
    .from('products').delete().eq('id', params.id).eq('retailer_id', user.id);
  if (error) {
    console.error('product delete failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  for (const u of urls) await removeStoredPhoto(u, user.id);
  return NextResponse.json({ ok: true });
}
