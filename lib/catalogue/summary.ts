import { attentionReasons } from './needs-attention';
import type { Picks } from './picks';
import { tagsOfProduct, type ProductTagRow, type TagRow } from './tags';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

export interface ProductSummary {
  id: string;
  name: string;
  created_at: string;
  folder_id: string | null;
  versionCount: number;
  /** Borrowed from the first-added version (spec §5.1). */
  photo_url: string | null;
  needsAttention: boolean;
  /** This product's own tags, A–Z. */
  tags: TagRow[];
}

/**
 * Dashboard cards from three flat queries (no per-card query). Products keep
 * the order they came in; the caller sorts them.
 */
export function summariseProducts(
  products: { id: string; name: string; created_at: string; folder_id?: string | null }[],
  pickers: { id: string; product_id: string }[],
  garments: {
    id: string; product_id: string; created_at: string; category: Category;
    measurements: MeasurementBag; picks: Picks; photo_url: string;
  }[],
  tagging: { tags: TagRow[]; productTags: ProductTagRow[] } = { tags: [], productTags: [] },
): ProductSummary[] {
  return products.map(p => {
    const versions = garments
      .filter(g => g.product_id === p.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const pickerIds = pickers.filter(k => k.product_id === p.id).map(k => k.id);
    return {
      id: p.id,
      name: p.name,
      created_at: p.created_at,
      folder_id: p.folder_id ?? null,
      versionCount: versions.length,
      photo_url: versions[0]?.photo_url ?? null,
      needsAttention: attentionReasons(versions, pickerIds).length > 0,
      tags: tagsOfProduct(p.id, tagging.tags, tagging.productTags),
    };
  });
}
