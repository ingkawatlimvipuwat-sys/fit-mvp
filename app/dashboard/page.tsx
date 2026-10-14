import { Suspense } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { summariseProducts } from '@/lib/catalogue/summary';
import type { FolderRow } from '@/lib/catalogue/folders';
import { tagsInUse, type ProductTagRow, type TagRow } from '@/lib/catalogue/tags';
import type { Category, MeasurementBag } from '@/lib/supabase/types';
import CopyPublicLink from './CopyPublicLink';
import CatalogueBrowser from './CatalogueBrowser';

export const metadata = { title: 'แดชบอร์ด — Fit MVP' };

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  // Seven flat queries, grouped in code: a per-card query would be an N+1.
  const [{ data: retailer }, productsRes, pickersRes, versionsRes, foldersRes, tagsRes, linksRes] =
    await Promise.all([
      supabase.from('retailers').select('shop_slug, shop_name').eq('id', user.id).single(),
      supabase.from('products').select('id, name, created_at, folder_id').eq('retailer_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('product_pickers').select('id, product_id'),
      supabase.from('garments')
        .select('id, product_id, category, measurements, picks, photo_url, created_at')
        .eq('retailer_id', user.id),
      supabase.from('folders').select('id, name, parent_id').eq('retailer_id', user.id),
      supabase.from('tags').select('id, name').eq('retailer_id', user.id),
      // RLS returns only the caller's links; tagsOfProduct/tagsInUse also ignore ids outside the caller's tags.
      supabase.from('product_tags').select('product_id, tag_id'),
    ]);

  // A failed read must not render as an empty dashboard ("no garments yet").
  const failed = productsRes.error ?? pickersRes.error ?? versionsRes.error ?? foldersRes.error
    ?? tagsRes.error ?? linksRes.error;
  if (failed) {
    console.error('dashboard load failed:', failed);
    throw new Error('dashboard data unavailable');
  }

  const tags = (tagsRes.data ?? []) as TagRow[];
  const links = (linksRes.data ?? []) as ProductTagRow[];
  const cards = summariseProducts(
    (productsRes.data ?? []) as { id: string; name: string; created_at: string; folder_id: string | null }[],
    pickersRes.data ?? [],
    (versionsRes.data ?? []) as {
      id: string; product_id: string; created_at: string; category: Category;
      measurements: MeasurementBag; picks: Record<string, string>; photo_url: string;
    }[],
    { tags, productTags: links },
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">{retailer?.shop_name}</h1>

      {retailer?.shop_slug && (
        <CopyPublicLink slug={retailer.shop_slug} />
      )}

      <Suspense fallback={null}>
        <CatalogueBrowser
          products={cards}
          folders={(foldersRes.data ?? []) as FolderRow[]}
          tags={tagsInUse(tags, links)}
          shopSlug={retailer?.shop_slug ?? null}
        />
      </Suspense>
    </div>
  );
}
