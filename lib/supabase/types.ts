import type { DimensionKey } from '@/lib/config/dimensions';
import type { FitRuleset } from '@/lib/fit/rules';

export type Category = 'top' | 'bottom' | 'dress';

export type MeasurementBag = Partial<Record<DimensionKey, number>>;

export interface Retailer {
  id: string;
  email: string;
  shop_name: string;
  shop_slug: string;
  created_at: string;
}

export interface Garment {
  id: string;
  retailer_id: string;
  name: string;
  category: Category;
  photo_url: string;
  /** Garment laid flat under daylight. Nullable: a colour reference, not a hero shot. */
  true_colour_photo_url: string | null;
  fit_profile: string;
  /** Preset reference. Mutually exclusive with fit_rule_override. */
  fit_ruleset_id: string | null;
  /** Inline rule for this garment only. Replaces the preset, never merges. */
  fit_rule_override: FitRuleset | null;
  measurements: MeasurementBag;
  created_at: string;
}

export interface FitSession {
  id: string;
  garment_id: string;
  customer_token: string | null;
  customer_measurements: MeasurementBag;
  result: unknown;
  /**
   * The ruleset that actually produced `result`, snapshotted at evaluation
   * time and never updated. Null for rows written before rulesets existed —
   * those all ran under the built-in defaults, which are still in the code.
   */
  applied_rule: FitRuleset | null;
  tryon_image_url: string | null;
  created_at: string;
}

export interface FitRulesetRow {
  id: string;
  retailer_id: string;
  name: string;
  rule: FitRuleset;
  created_at: string;
}

export type Finish = 'matte' | 'slight_sheen' | 'glossy';
export type Thickness = 'thin' | 'medium' | 'thick';
export type Stretch = 'none' | 'some' | 'high';
export type Feel = 'soft' | 'crisp' | 'rough';

export interface GarmentColour {
  id: string;
  garment_id: string;
  /** Always '#rrggbb'. Enforced by a CHECK constraint and by zod. */
  hex: string;
  name: string;
  created_at: string;
}

/**
 * Zero or one per garment. Every content field is nullable, and null means
 * "the retailer did not say" — never "no". isFabricEmpty() in
 * lib/garment/colour-fabric.ts is the only correct way to ask whether this row
 * carries any information, because it ignores garment_id/updated_at.
 */
export interface GarmentFabric {
  garment_id: string;
  finish: Finish | null;
  thickness: Thickness | null;
  stretch: Stretch | null;
  feel: Feel | null;
  composition: string | null;
  weight_gsm: number | null;
  construction: string | null;
  thread_count: number | null;
  pore_size_mm: number | null;
  notes: string | null;
  fabric_photo_url: string | null;
  updated_at: string;
}
