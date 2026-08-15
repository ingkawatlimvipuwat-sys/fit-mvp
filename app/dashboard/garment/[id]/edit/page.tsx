import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ruleSelectionForGarment } from '@/lib/fit/rule-selection';
import GarmentForm from '@/app/dashboard/garment/GarmentForm';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export default async function EditGarmentPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  // Scoped by retailer_id: another shop's garment reads as nonexistent, and a
  // malformed id fails the query the same way. Both land on notFound().
  const { data: g } = await supabase
    .from('garments')
    .select('id, name, category, photo_url, measurements, fit_profile, fit_ruleset_id, fit_rule_override')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!g) notFound();

  const selection = ruleSelectionForGarment({
    fit_profile: g.fit_profile,
    fit_ruleset_id: g.fit_ruleset_id,
    fit_rule_override: g.fit_rule_override,
  });

  return (
    <GarmentForm
      mode="edit"
      initial={{
        id: g.id,
        name: g.name,
        category: g.category as Category,
        photo_url: g.photo_url,
        measurements: (g.measurements ?? {}) as MeasurementBag,
        ...selection,
      }}
    />
  );
}
