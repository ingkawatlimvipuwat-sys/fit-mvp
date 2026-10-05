import { notFound } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import GarmentForm, { type GarmentFormInitial, type ProductCtx } from '@/app/dashboard/garment/GarmentForm';
import { ruleSelectionForGarment } from '@/lib/fit/rule-selection';
import { emptyFabricForm, FABRIC_FIELDS, type Colour } from '@/lib/garment/colour-fabric';
import { loadProductContext } from '@/lib/catalogue/ownership';
import { usedValuesByPicker } from '@/lib/catalogue/picks';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export const metadata = { title: 'เพิ่มแบบ — Fit MVP' };

/**
 * /dashboard/garment/new                      a plain garment (a shop with no product yet)
 * /dashboard/garment/new?product=ID           a new version of that product
 * /dashboard/garment/new?product=ID&copy=VID  the same, pre-filled from version VID (Duplicate)
 */
export default async function NewGarmentPage(props: {
  searchParams: Promise<{ product?: string; copy?: string }>;
}) {
  const { product: productId, copy } = await props.searchParams;
  if (!productId) return <GarmentForm mode="create" />;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // layout already redirects

  const found = await loadProductContext(supabase, user.id, productId);
  if (!found.ok) {
    if (found.status === 404) notFound();
    throw new Error('product data unavailable');
  }
  const { ctx } = found;
  const productCtx: ProductCtx = {
    id: ctx.id,
    name: ctx.name,
    pickers: ctx.pickers,
    usedValues: usedValuesByPicker(ctx.versions, ctx.pickers),
  };

  if (!copy) return <GarmentForm mode="create" productCtx={productCtx} />;

  // Duplicate: the source must be a version of THIS product and this shop's.
  const { data: g } = await supabase
    .from('garments')
    .select('id, category, size_label, picks, photo_url, true_colour_photo_url, measurements, fit_profile, fit_ruleset_id, fit_rule_override')
    .eq('id', copy)
    .eq('product_id', productId)
    .eq('retailer_id', user.id)
    .single();
  if (!g) notFound();

  const [{ data: colourRows }, { data: fabricRow }] = await Promise.all([
    supabase.from('garment_colours').select('hex, name').eq('garment_id', copy).order('created_at', { ascending: true }),
    supabase.from('garment_fabric').select('*').eq('garment_id', copy).maybeSingle(),
  ]);
  const fabricForm = emptyFabricForm();
  if (fabricRow) {
    for (const k of FABRIC_FIELDS) {
      const v = (fabricRow as Record<string, unknown>)[k];
      fabricForm[k] = v === null || v === undefined ? '' : String(v);
    }
  }

  const initial: GarmentFormInitial = {
    id: g.id,
    name: ctx.name,
    category: g.category as Category,
    sizeLabel: typeof g.size_label === 'string' ? g.size_label : '',
    picks: (g.picks ?? {}) as Record<string, string>,
    photo_url: g.photo_url,
    measurements: (g.measurements ?? {}) as MeasurementBag,
    ...ruleSelectionForGarment({
      fit_profile: g.fit_profile,
      fit_ruleset_id: g.fit_ruleset_id,
      fit_rule_override: g.fit_rule_override,
    }),
    colours: (colourRows ?? []) as Colour[],
    true_colour_photo_url: g.true_colour_photo_url ?? null,
    fabric: fabricForm,
    fabric_photo_url: fabricRow?.fabric_photo_url ?? null,
  };

  return <GarmentForm mode="create" initial={initial} copyFrom={g.id} productCtx={productCtx} />;
}
