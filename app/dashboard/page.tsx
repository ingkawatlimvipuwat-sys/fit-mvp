import { createSupabaseServerClient } from '@/lib/supabase/server';
import CopyPublicLink from './CopyPublicLink';
import AddGarmentLink from './AddGarmentLink';
import GarmentGrid from './GarmentGrid';

export const metadata = { title: 'แดชบอร์ด — Fit MVP' };

export default async function DashboardPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  const [{ data: retailer }, { data: garments }] = await Promise.all([
    supabase.from('retailers').select('shop_slug, shop_name').eq('id', user.id).single(),
    supabase.from('garments').select('id, name, category, photo_url, created_at').eq('retailer_id', user.id).order('created_at', { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{retailer?.shop_name}</h1>
        <AddGarmentLink />
      </div>

      {retailer?.shop_slug && (
        <CopyPublicLink slug={retailer.shop_slug} />
      )}

      <GarmentGrid garments={garments ?? []} shopSlug={retailer?.shop_slug ?? null} />
    </div>
  );
}
