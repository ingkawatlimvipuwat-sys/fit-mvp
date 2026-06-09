import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function ShopPage({ params }: { params: { shop_slug: string } }) {
  // Use admin client for public read because anon RLS is set up but using the
  // admin client here keeps the server component simple. No secrets leak.
  const supabase = createSupabaseAdminClient();
  const { data: shop } = await supabase
    .from('shops')
    .select('id, shop_name, shop_slug')
    .eq('shop_slug', params.shop_slug)
    .single();
  if (!shop) notFound();

  const { data: garments } = await supabase
    .from('garments')
    .select('id, name, category, photo_url')
    .eq('retailer_id', shop.id)
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">{shop.shop_name}</h1>
      {!garments || garments.length === 0 ? (
        <p className="mt-6 text-gray-600">ยังไม่มีสินค้า</p>
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
  );
}
