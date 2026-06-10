import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import FitChecker from './FitChecker';
import type { Category } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function HeroPage({
  params,
}: { params: { shop_slug: string; garment_id: string } }) {
  const supabase = createSupabaseAdminClient();
  const { data: garment } = await supabase
    .from('garments')
    .select('id, name, category, photo_url, fit_profile, measurements')
    .eq('id', params.garment_id)
    .single();
  if (!garment) notFound();

  const dims = dimensionsForCategory(garment.category as Category);

  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <div className="aspect-square overflow-hidden rounded bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={garment.photo_url} alt={garment.name} className="h-full w-full object-cover" />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{garment.name}</h1>

      <FitChecker
        garmentId={garment.id}
        dimensions={dims.map(d => ({
          key: d.key, labelTh: d.labelTh, hintTh: d.measureHintTh,
        }))}
      />
    </main>
  );
}
