import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { attentionReasons, type AttentionReason } from '@/lib/catalogue/needs-attention';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import ProductEditor, { type VersionRow } from './ProductEditor';

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { title: 'สินค้า — Fit MVP' };
    const { data } = await supabase.from('products').select('name')
      .eq('id', params.id).eq('retailer_id', user.id).single();
    return { title: data?.name ? `${data.name} — Fit MVP` : 'สินค้า — Fit MVP' };
  } catch {
    return { title: 'สินค้า — Fit MVP' };
  }
}

export default async function ProductPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  // Scoped by retailer_id: another shop's product reads as nonexistent.
  const found = await loadProductContext(supabase, user.id, params.id);
  if (!found.ok) {
    if (found.status === 404) notFound();
    throw new Error('product data unavailable');
  }
  const { ctx } = found;
  const ids = ctx.versions.map(v => v.id);

  const [{ data: retailer }, { data: photos }, { data: colours }] = await Promise.all([
    supabase.from('retailers').select('shop_slug').eq('id', user.id).single(),
    ids.length
      ? supabase.from('garments').select('id, photo_url').eq('product_id', params.id).eq('retailer_id', user.id)
      : Promise.resolve({ data: [] as { id: string; photo_url: string }[] }),
    ids.length
      ? supabase.from('garment_colours').select('garment_id, hex, created_at').in('garment_id', ids)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { garment_id: string; hex: string }[] }),
  ]);

  const photoById = new Map((photos ?? []).map(p => [p.id, p.photo_url]));
  const firstColour = new Map<string, string>();
  for (const c of colours ?? []) if (!firstColour.has(c.garment_id)) firstColour.set(c.garment_id, c.hex);

  const pickerIds = ctx.pickers.map(p => p.id);
  const rows: VersionRow[] = ctx.versions.map(v => {
    const bag = (v.measurements ?? {}) as Record<string, number | undefined>;
    return {
      id: v.id,
      picks: v.picks ?? {},
      photo_url: photoById.get(v.id) ?? null,
      colour: firstColour.get(v.id) ?? null,
      measurements: dimensionsForCategory(v.category)
        .filter(d => typeof bag[d.key] === 'number')
        .slice(0, 3)
        .map(d => ({ labelTh: d.labelTh, labelEn: d.labelEn, value: bag[d.key] as number })),
      reasons: attentionReasons([{ category: v.category, measurements: v.measurements, picks: v.picks ?? {} }], pickerIds)
        .filter((r): r is Exclude<AttentionReason, 'no_versions'> => r !== 'no_versions'),
    };
  });

  return (
    <ProductEditor
      productId={ctx.id}
      name={ctx.name}
      shopSlug={retailer?.shop_slug ?? null}
      pickers={ctx.pickers}
      versions={rows}
    />
  );
}
