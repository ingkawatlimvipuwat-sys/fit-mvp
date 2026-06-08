import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import CopyPublicLink from './CopyPublicLink';

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
            <li key={g.id} className="overflow-hidden rounded border bg-white">
              <div className="relative aspect-square bg-gray-100">
                {/* photo_url is a public Supabase Storage URL */}
                {g.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={g.photo_url} alt={g.name} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium">{g.name}</div>
                <div className="text-xs text-gray-500">{g.category}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
