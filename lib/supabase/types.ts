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
