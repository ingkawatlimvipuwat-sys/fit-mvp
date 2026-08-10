import type { Category } from '@/lib/supabase/types';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { EaseRule } from '@/lib/fit/rules';

export type DimensionKey =
  | 'shoulder_cm' | 'chest_cm' | 'waist_cm' | 'hip_cm' | 'length_cm' | 'sleeve_cm';

/**
 * Each band is a difference (customer - garment) range, inclusive of lower bound.
 * Verdict resolution iterates in this order; first match wins.
 */
export interface ThresholdBand {
  min: number;          // inclusive lower bound on (customer - garment)
  max: number;          // exclusive upper bound on (customer - garment)
  verdict: 'too_tight' | 'snug' | 'good_fit' | 'loose';
}

export interface Dimension {
  key: DimensionKey;
  labelTh: string;
  labelEn: string;
  measureHintTh: string;
  measureHintEn: string;
  categories: Category[];
  defaultRule: EaseRule;
}

export const DIMENSIONS: Dimension[] = [
  {
    key: 'shoulder_cm',
    labelTh: 'ไหล่', labelEn: 'Shoulder',
    measureHintTh: 'วัดจากปลายไหล่ข้างหนึ่งถึงอีกข้าง',
    measureHintEn: 'Measure from one shoulder tip to the other.',
    categories: ['top', 'dress'],
    defaultRule: DEFAULT_RULE,
  },
  {
    key: 'chest_cm',
    labelTh: 'รอบอก', labelEn: 'Chest',
    measureHintTh: 'วัดรอบส่วนที่กว้างที่สุดของอก',
    measureHintEn: 'Measure around the fullest part of the chest.',
    categories: ['top', 'dress'],
    defaultRule: DEFAULT_RULE,
  },
  {
    key: 'waist_cm',
    labelTh: 'รอบเอว', labelEn: 'Waist',
    measureHintTh: 'วัดรอบส่วนที่แคบที่สุดของเอว',
    measureHintEn: 'Measure around the narrowest part of the waist.',
    categories: ['top', 'bottom', 'dress'],
    defaultRule: DEFAULT_RULE,
  },
  {
    key: 'hip_cm',
    labelTh: 'รอบสะโพก', labelEn: 'Hip',
    measureHintTh: 'วัดรอบส่วนที่กว้างที่สุดของสะโพก',
    measureHintEn: 'Measure around the fullest part of the hips.',
    categories: ['bottom', 'dress'],
    defaultRule: DEFAULT_RULE,
  },
  {
    key: 'length_cm',
    labelTh: 'ความยาว', labelEn: 'Length',
    measureHintTh: 'วัดจากบนสุดถึงล่างสุดของเสื้อผ้า',
    measureHintEn: 'Measure top to bottom of the garment.',
    categories: ['top', 'bottom', 'dress'],
    defaultRule: DEFAULT_RULE,
  },
  {
    key: 'sleeve_cm',
    labelTh: 'ความยาวแขน', labelEn: 'Sleeve',
    measureHintTh: 'วัดจากไหล่ถึงข้อมือ',
    measureHintEn: 'Measure from shoulder to wrist.',
    categories: ['top', 'dress'],
    defaultRule: DEFAULT_RULE,
  },
];

export function dimensionsForCategory(c: Category): Dimension[] {
  return DIMENSIONS.filter(d => d.categories.includes(c));
}

export function dimensionByKey(key: string): Dimension | undefined {
  return DIMENSIONS.find(d => d.key === key);
}
