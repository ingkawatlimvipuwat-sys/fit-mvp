import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import ShopHeader from './ShopHeader';
import NoGarments from './NoGarments';
import ColourDots from './ColourDots';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { shop_slug: string } }) {
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

export default async function ShopPage({ params }: { params: { shop_slug: string } }) {
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

  const { data: garments } = await supabase
    .from('garments')
    .select('id, name, category, photo_url')
    .eq('retailer_id', shop.id)
    .order('created_at', { ascending: false });

  // One query for the whole grid, grouped in code. A per-card query would be an
  // N+1 on a page that exists to list a shop's entire catalogue.
  const ids = (garments ?? []).map(g => g.id);
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
      {!garments || garments.length === 0 ? (
        <NoGarments />
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {garments.map(g => (
            <li key={g.id}>
              <Link href={`/shop/${params.shop_slug}/${g.id}`} className="block overflow-hidden rounded border bg-white">
                <div className="aspect-square bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={g.photo_url} alt={g.name} className="h-full w-full object-cover" />
                </div>
                <div className="p-3 text-sm">
                  {g.name}
                  <div className="mt-1.5">
                    <ColourDots colours={coloursByGarment.get(g.id) ?? []} />
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
