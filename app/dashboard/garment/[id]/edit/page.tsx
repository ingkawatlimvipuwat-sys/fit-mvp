import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ruleSelectionForGarment } from '@/lib/fit/rule-selection';
import GarmentForm from '@/app/dashboard/garment/GarmentForm';
import { emptyFabricForm } from '@/app/dashboard/garment/FabricSection';
import { FABRIC_FIELDS, type Colour } from '@/lib/garment/colour-fabric';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

/**
 * Its own query: generateMetadata runs separately from the page body and
 * cannot share its result. Degrades to the generic title rather than
 * throwing — a generateMetadata that throws takes the whole page down.
 */
export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { title: 'แก้ไขเสื้อผ้า — Fit MVP' };
    const { data } = await supabase
      .from('garments')
      .select('name')
      .eq('id', params.id)
      .eq('retailer_id', user.id)
      .single();
    return { title: data?.name ? `แก้ไข ${data.name} — Fit MVP` : 'แก้ไขเสื้อผ้า — Fit MVP' };
  } catch {
    return { title: 'แก้ไขเสื้อผ้า — Fit MVP' };
  }
}

export default async function EditGarmentPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  // Scoped by retailer_id: another shop's garment reads as nonexistent, and a
  // malformed id fails the query the same way. Both land on notFound().
  const { data: g } = await supabase
    .from('garments')
    .select('id, name, category, photo_url, true_colour_photo_url, measurements, fit_profile, fit_ruleset_id, fit_rule_override')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!g) notFound();

  const selection = ruleSelectionForGarment({
    fit_profile: g.fit_profile,
    fit_ruleset_id: g.fit_ruleset_id,
    fit_rule_override: g.fit_rule_override,
  });

  const [{ data: colourRows }, { data: fabricRow }] = await Promise.all([
    supabase.from('garment_colours').select('hex, name')
      .eq('garment_id', params.id).order('created_at', { ascending: true }),
    supabase.from('garment_fabric').select('*')
      .eq('garment_id', params.id).maybeSingle(),
  ]);

  // The form holds every fabric field as a string; '' means "not set".
  const fabricForm = emptyFabricForm();
  if (fabricRow) {
    for (const k of FABRIC_FIELDS) {
      const v = (fabricRow as Record<string, unknown>)[k];
      fabricForm[k] = v === null || v === undefined ? '' : String(v);
    }
  }

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
        colours: (colourRows ?? []) as Colour[],
        true_colour_photo_url: g.true_colour_photo_url ?? null,
        fabric: fabricForm,
        fabric_photo_url: fabricRow?.fabric_photo_url ?? null,
      }}
    />
  );
}
