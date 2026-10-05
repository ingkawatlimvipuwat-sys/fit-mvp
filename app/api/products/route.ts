import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseProductName } from '@/lib/catalogue/parse';
import { t } from '@/lib/i18n/strings';

/** Create a product. New products start with the pickers Size and Colour (spec §2). */
export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = parseProductName(body?.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });

  const { data: product, error } = await supabase
    .from('products')
    .insert({ retailer_id: user.id, name: name.value })
    .select('id')
    .single();
  if (error || !product) {
    console.error('product insert failed:', error);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  const { error: pickerErr } = await supabase.from('product_pickers').insert([
    { product_id: product.id, name: t.pickerSize.th, position: 0 },
    { product_id: product.id, name: t.pickerColour.th, position: 1 },
  ]);
  if (pickerErr) {
    console.error('default pickers insert failed:', pickerErr);
    await supabase.from('products').delete().eq('id', product.id).eq('retailer_id', user.id);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: product.id });
}
