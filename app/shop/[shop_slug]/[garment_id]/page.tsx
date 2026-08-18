import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import FitChecker from './FitChecker';
import BackLink from './BackLink';
import OtherGarments from './OtherGarments';
import ShopHeader from '../ShopHeader';
import type { Category } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: { params: { shop_slug: string; garment_id: string } }) {
  const fallback = { title: 'Fit MVP — หาขนาดที่ใช่' };
  try {
    const supabase = createSupabaseAdminClient();
    const { data: shop } = await supabase
      .from('shops')
      .select('id, shop_name')
      .eq('shop_slug', params.shop_slug)
      .single();
    if (!shop) return fallback;

    const { data: garment } = await supabase
      .from('garments')
      .select('name')
      .eq('id', params.garment_id)
      .eq('retailer_id', shop.id)
      .single();
    if (!garment) return fallback;

    return { title: `${garment.name} — ${shop.shop_name}` };
  } catch {
    return fallback;
  }
}

export default async function HeroPage({
  params,
}: { params: { shop_slug: string; garment_id: string } }) {
  const supabase = createSupabaseAdminClient();

  // Resolve the shop first so the garment can be scoped to it — otherwise a
  // valid garment id would render under any (even bogus) shop slug.
  const { data: shop, error: shopError } = await supabase
    .from('shops')
    .select('id, shop_name')
    .eq('shop_slug', params.shop_slug)
    .single();
  if (shopError && shopError.code !== 'PGRST116') {
    throw new Error('shop data unavailable: ' + shopError.message);
  }
  if (!shop) notFound();

  const [{ data: garment, error: garmentError }, { data: others }] = await Promise.all([
    supabase
      .from('garments')
      .select('id, name, category, photo_url, fit_profile, measurements')
      .eq('id', params.garment_id)
      .eq('retailer_id', shop.id)
      .single(),
    supabase
      .from('garments')
      .select('id, name, photo_url')
      .eq('retailer_id', shop.id)
      .neq('id', params.garment_id)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (garmentError && garmentError.code !== 'PGRST116') {
    throw new Error('shop data unavailable: ' + garmentError.message);
  }
  if (!garment) notFound();

  const dims = dimensionsForCategory(garment.category as Category);

  return (
    <>
      <ShopHeader shopName={shop.shop_name} shopSlug={params.shop_slug} />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <BackLink shopSlug={params.shop_slug} />
        <div className="mt-3 aspect-square overflow-hidden rounded bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={garment.photo_url} alt={garment.name} className="h-full w-full object-cover" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">{garment.name}</h1>

        <FitChecker
          garmentId={garment.id}
          dimensions={dims.map(d => ({
            key: d.key,
            labelTh: d.labelTh,
            hintTh: d.measureHintTh,
            labelEn: d.labelEn,
            hintEn: d.measureHintEn,
          }))}
        />

        <OtherGarments shopSlug={params.shop_slug} others={others ?? []} />
      </main>
    </>
  );
}
