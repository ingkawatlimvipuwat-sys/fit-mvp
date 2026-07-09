import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import ShopHeader from './ShopHeader';
import NoGarments from './NoGarments';

export const dynamic = 'force-dynamic';

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

  return (
    <>
      <ShopHeader shopName={shop.shop_name} />
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
                <div className="p-3 text-sm">{g.name}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      </main>
    </>
  );
}
