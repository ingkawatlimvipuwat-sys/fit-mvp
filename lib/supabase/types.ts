import type { DimensionKey } from '@/lib/config/dimensions';

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
  measurements: MeasurementBag;
  created_at: string;
}

export interface FitSession {
  id: string;
  garment_id: string;
  customer_token: string | null;
  customer_measurements: MeasurementBag;
  result: unknown;
  tryon_image_url: string | null;
  created_at: string;
}
