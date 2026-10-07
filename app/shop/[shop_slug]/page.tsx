import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import ShopHeader from './ShopHeader';
import NoGarments from './NoGarments';
import ColourDots from './ColourDots';
import { isComplete } from '@/lib/catalogue/picks';

export const dynamic = 'force-dynamic';

export async function generateMetadata(props: { params: Promise<{ shop_slug: string }> }) {
  const params = await props.params;
  const fallback = { title: 'Fit MVP — หาขนาดที่ใช่' };
  try {
    const supabase = createSupabaseAdminClient();
    const { data: shop } = await supabase
      .from('shops')
      .select('shop_name')
      .eq('shop_slug', params.shop_slug)
      .single();
    if (!shop) return fallback;
    return { title: `${shop.shop_name} — Fit MVP` };
  } catch {
    return fallback;
  }
}

export default async function ShopPage(props: { params: Promise<{ shop_slug: string }> }) {
  const params = await props.params;
  const supabase = createSupabaseAdminClient();
  const { data: shop, error } = await supabase
    .from('shops')
    .select('id, shop_name, shop_slug')
    .eq('shop_slug', params.shop_slug)
    .single();
  if (error && error.code !== 'PGRST116') {
    throw new Error('shop data unavailable: ' + error.message);
  }
  if (!shop) notFound();

  // One card per product (spec 6). Three flat queries, grouped in code.
  const [{ data: products }, { data: versionRows }] = await Promise.all([
    supabase.from('products').select('id, name, created_at')
      .eq('retailer_id', shop.id).order('created_at', { ascending: false }),
    supabase.from('garments').select('id, product_id, photo_url, picks, created_at')
      .eq('retailer_id', shop.id).order('created_at', { ascending: true }),
  ]);

  const productIds = (products ?? []).map(p => p.id);
  const { data: pickerRows } = productIds.length
    ? await supabase.from('product_pickers').select('id, product_id').in('product_id', productIds)
    : { data: [] as { id: string; product_id: string }[] };

  const pickerIdsByProduct = new Map<string, string[]>();
  for (const k of pickerRows ?? []) {
    const list = pickerIdsByProduct.get(k.product_id) ?? [];
    list.push(k.id);
    pickerIdsByProduct.set(k.product_id, list);
  }

  // A card shows the first-added COMPLETE version's photo; a product with none is hidden.
  const firstVersion = new Map<string, { id: string; photo_url: string }>();
  for (const v of versionRows ?? []) {
    if (firstVersion.has(v.product_id)) continue;
    if (isComplete(v.picks ?? {}, pickerIdsByProduct.get(v.product_id) ?? [])) {
      firstVersion.set(v.product_id, { id: v.id, photo_url: v.photo_url });
    }
  }
  const cards = (products ?? [])
    .filter(p => firstVersion.has(p.id))
    .map(p => ({
      key: p.id, name: p.name, photo_url: firstVersion.get(p.id)!.photo_url,
      href: `/shop/${params.shop_slug}/p/${p.id}`, colourFrom: firstVersion.get(p.id)!.id,
    }));
  const garments = cards;

  // One query for the whole grid, grouped in code. A per-card query would be an
  // N+1 on a page that exists to list a shop's entire catalogue.
  const ids = garments.map(g => g.colourFrom);
  let colourRows: { garment_id: string; hex: string; name: string }[] | null = [];
  if (ids.length) {
    const { data } = await supabase
      .from('garment_colours')
      .select('garment_id, hex, name')
      .in('garment_id', ids)
      .order('created_at', { ascending: true });
    colourRows = data;
  }

  const coloursByGarment = new Map<string, { hex: string; name: string }[]>();
  for (const r of colourRows ?? []) {
    const list = coloursByGarment.get(r.garment_id) ?? [];
    list.push({ hex: r.hex, name: r.name });
    coloursByGarment.set(r.garment_id, list);
  }

  return (
    <>
      <ShopHeader shopName={shop.shop_name} shopSlug={params.shop_slug} />
      <main className="mx-auto max-w-4xl px-6 py-8">
      {garments.length === 0 ? (
        <NoGarments />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {garments.map(g => (
            <li key={g.key}>
              <Link href={g.href} className="block overflow-hidden rounded border bg-white">
                <div className="aspect-square bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.photo_url} alt={g.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-3 text-sm">
                  {g.name}
                  <div className="mt-1.5">
                    <ColourDots colours={coloursByGarment.get(g.colourFrom) ?? []} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </main>
    </>
  );
}
