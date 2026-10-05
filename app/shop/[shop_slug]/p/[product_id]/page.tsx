import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { isComplete, type PickerDef } from '@/lib/catalogue/picks';
import ShopHeader from '../../ShopHeader';
import BackLink from '../../[garment_id]/BackLink';
import OtherGarments from '../../[garment_id]/OtherGarments';
import ProductView, { type ShopperVersion } from './ProductView';
import type { Category, GarmentFabric } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

type Params = { shop_slug: string; product_id: string };

export async function generateMetadata(props: { params: Promise<Params> }) {
  const params = await props.params;
  const fallback = { title: 'Fit MVP — หาขนาดที่ใช่' };
  try {
    const supabase = createSupabaseAdminClient();
    const { data: shop } = await supabase
      .from('shops').select('id, shop_name').eq('shop_slug', params.shop_slug).single();
    if (!shop) return fallback;
    const { data: product } = await supabase
      .from('products').select('name').eq('id', params.product_id).eq('retailer_id', shop.id).single();
    if (!product) return fallback;
    return { title: `${product.name} — ${shop.shop_name}` };
  } catch {
    return fallback;
  }
}

export default async function ProductPage(props: { params: Promise<Params> }) {
  const params = await props.params;
  const supabase = createSupabaseAdminClient();

  // Resolve the shop first so the product can be scoped to it — otherwise a
  // valid product id would render under any (even bogus) shop slug.
  const { data: shop, error: shopError } = await supabase
    .from('shops').select('id, shop_name').eq('shop_slug', params.shop_slug).single();
  if (shopError && shopError.code !== 'PGRST116') {
    throw new Error('shop data unavailable: ' + shopError.message);
  }
  if (!shop) notFound();

  const [
    { data: product, error: productError },
    { data: pickerRows },
    { data: versionRows },
    { data: otherProducts },
  ] = await Promise.all([
    supabase.from('products').select('id, name')
      .eq('id', params.product_id).eq('retailer_id', shop.id).single(),
    supabase.from('product_pickers').select('id, name, position')
      .eq('product_id', params.product_id).order('position', { ascending: true }),
    supabase.from('garments')
      .select('id, category, size_label, photo_url, true_colour_photo_url, picks, created_at')
      .eq('product_id', params.product_id).eq('retailer_id', shop.id)
      .order('created_at', { ascending: true }),
    supabase.from('products').select('id, name')
      .eq('retailer_id', shop.id).neq('id', params.product_id)
      .order('created_at', { ascending: false }).limit(8),
  ]);
  if (productError && productError.code !== 'PGRST116') {
    throw new Error('shop data unavailable: ' + productError.message);
  }
  if (!product) notFound();

  const pickers = (pickerRows ?? []) as PickerDef[];
  const pickerIds = pickers.map(p => p.id);

  // Rule 9: the shopper only ever sees complete versions.
  const complete = (versionRows ?? []).filter(v => isComplete(v.picks ?? {}, pickerIds));
  if (complete.length === 0) notFound();

  const ids = complete.map(v => v.id);
  const otherIds = (otherProducts ?? []).map(p => p.id);
  const [{ data: colourRows }, { data: fabricRows }, { data: otherPhotos }] = await Promise.all([
    supabase.from('garment_colours').select('garment_id, hex, name')
      .in('garment_id', ids).order('created_at', { ascending: true }),
    supabase.from('garment_fabric').select('*').in('garment_id', ids),
    otherIds.length
      ? supabase.from('garments').select('product_id, photo_url, created_at')
          .in('product_id', otherIds).eq('retailer_id', shop.id).order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as { product_id: string; photo_url: string }[] }),
  ]);

  const colours = new Map<string, { hex: string; name: string }[]>();
  for (const c of colourRows ?? []) {
    const list = colours.get(c.garment_id) ?? [];
    list.push({ hex: c.hex, name: c.name });
    colours.set(c.garment_id, list);
  }
  const fabrics = new Map((fabricRows ?? []).map(f => [f.garment_id as string, f as GarmentFabric]));

  const versions: ShopperVersion[] = complete.map(v => ({
    id: v.id,
    created_at: v.created_at,
    picks: v.picks ?? {},
    photo_url: v.photo_url,
    size_label: v.size_label ?? null,
    true_colour_photo_url: v.true_colour_photo_url ?? null,
    colours: colours.get(v.id) ?? [],
    fabric: fabrics.get(v.id) ?? null,
    dims: dimensionsForCategory(v.category as Category).map(d => ({
      key: d.key,
      labelTh: d.labelTh,
      hintTh: d.measureHintTh,
      labelEn: d.labelEn,
      hintEn: d.measureHintEn,
    })),
  }));

  // One card per product; a product with no photo-bearing version has nothing to show.
  const firstPhoto = new Map<string, string>();
  for (const g of otherPhotos ?? []) if (!firstPhoto.has(g.product_id)) firstPhoto.set(g.product_id, g.photo_url);
  const others = (otherProducts ?? [])
    .filter(p => firstPhoto.has(p.id))
    .map(p => ({
      id: p.id,
      name: p.name,
      photo_url: firstPhoto.get(p.id) as string,
      href: `/shop/${params.shop_slug}/p/${p.id}`,
    }));

  return (
    <>
      <ShopHeader shopName={shop.shop_name} shopSlug={params.shop_slug} />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <BackLink shopSlug={params.shop_slug} />
        <ProductView name={product.name} pickers={pickers} versions={versions} />
        <OtherGarments others={others} />
      </main>
    </>
  );
}
