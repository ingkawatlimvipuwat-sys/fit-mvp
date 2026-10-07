import { createSupabaseServerClient } from '@/lib/supabase/server';
import { summariseProducts } from '@/lib/catalogue/summary';
import type { Category, MeasurementBag } from '@/lib/supabase/types';
import CopyPublicLink from './CopyPublicLink';
import AddProductLink from './AddProductLink';
import ProductGrid from './ProductGrid';

export const metadata = { title: 'แดชบอร์ด — Fit MVP' };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  // Four flat queries, grouped in code: a per-card query would be an N+1.
  const [{ data: retailer }, { data: products }, { data: pickers }, { data: versions }] =
    await Promise.all([
      supabase.from('retailers').select('shop_slug, shop_name').eq('id', user.id).single(),
      supabase.from('products').select('id, name, created_at').eq('retailer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('product_pickers').select('id, product_id'),
      supabase.from('garments')
        .select('id, product_id, category, measurements, picks, photo_url, created_at')
        .eq('retailer_id', user.id),
    ]);

  const cards = summariseProducts(
    products ?? [],
    pickers ?? [],
    (versions ?? []) as {
      id: string; product_id: string; created_at: string; category: Category;
      measurements: MeasurementBag; picks: Record<string, string>; photo_url: string;
    }[],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{retailer?.shop_name}</h1>
        <AddProductLink />
      </div>

      {retailer?.shop_slug && (
        <CopyPublicLink slug={retailer.shop_slug} />
      )}

      <ProductGrid products={cards} shopSlug={retailer?.shop_slug ?? null} />
    </div>
  );
}
