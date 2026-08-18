import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import CopyPublicLink from './CopyPublicLink';
import GarmentCard from './GarmentCard';

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
        <Link href="/dashboard/garment/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          {t.addGarment.th}
        </Link>
      </div>

      {retailer?.shop_slug && (
        <CopyPublicLink slug={retailer.shop_slug} />
      )}

      {!garments || garments.length === 0 ? (
        <p className="text-gray-600">{t.noGarments.th}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {garments.map(g => (
            <li key={g.id}>
              <GarmentCard garment={g} shopSlug={retailer?.shop_slug ?? null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
