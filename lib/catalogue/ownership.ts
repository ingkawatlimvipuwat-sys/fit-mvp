import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import type { PickerDef, Picks } from './picks';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export interface ProductContext {
  id: string;
  name: string;
  pickers: PickerDef[];
  versions: { id: string; picks: Picks; created_at: string; category: Category; measurements: MeasurementBag }[];
}
export type Failure = { ok: false; status: 404 | 500; error: string };

const fail500: Failure = { ok: false, status: 500, error: t.saveFailed.th };
const fail404: Failure = { ok: false, status: 404, error: 'not found' };

/**
 * One product, its pickers and its versions, for a caller. The product read is
 * scoped by retailer_id so another shop's id looks nonexistent; pickers and
 * versions are then read by that verified product id. A failed read is a 500,
 * never a pass (same pattern as lib/garment/ruleset-ownership.ts).
 */
export async function loadProductContext(
  supabase: SupabaseClient, userId: string, productId: string,
): Promise<{ ok: true; ctx: ProductContext } | Failure> {
  const { data: product, error } = await supabase
    .from('products').select('id, name').eq('id', productId).eq('retailer_id', userId).maybeSingle();
  if (error) { console.error('product lookup failed:', error); return fail500; }
  if (!product) return fail404;

  const [{ data: pickers, error: pErr }, { data: versions, error: vErr }] = await Promise.all([
    supabase.from('product_pickers').select('id, name, position')
      .eq('product_id', productId).order('position', { ascending: true }),
    supabase.from('garments').select('id, picks, created_at, category, measurements')
      .eq('product_id', productId).eq('retailer_id', userId).order('created_at', { ascending: true }),
  ]);
  if (pErr || vErr) { console.error('product detail lookup failed:', pErr ?? vErr); return fail500; }
  return {
    ok: true,
    ctx: {
      id: product.id,
      name: product.name,
      pickers: (pickers ?? []) as PickerDef[],
      versions: (versions ?? []) as ProductContext['versions'],
    },
  };
}

/** Is this garment the caller's? Used for `copy_from`. */
export async function checkGarmentOwnership(
  supabase: SupabaseClient, userId: string, garmentId: string,
): Promise<{ ok: true } | Failure> {
  const { data, error } = await supabase
    .from('garments').select('id').eq('id', garmentId).eq('retailer_id', userId).maybeSingle();
  if (error) { console.error('garment ownership lookup failed:', error); return fail500; }
  return data ? { ok: true } : fail404;
}
