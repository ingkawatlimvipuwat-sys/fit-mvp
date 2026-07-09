import type { Category } from '@/lib/supabase/types';

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
  defaultBands: readonly ThresholdBand[];   // ordered top-down by verdict severity
}

const INF = Number.POSITIVE_INFINITY;

/** Default bands per the design spec (§7). Most dimensions share these defaults. */
const DEFAULT_BANDS: readonly ThresholdBand[] = [
  { min: 1,    max: INF,  verdict: 'too_tight' }, // customer > garment + 1
  { min: -1,   max: 1,    verdict: 'snug' },      // within ±1
  { min: -5,   max: -1,   verdict: 'good_fit' },  // 1–5cm smaller than garment
  { min: -INF, max: -5,   verdict: 'loose' },     // > 5cm smaller
];

export const DIMENSIONS: Dimension[] = [
  {
    key: 'shoulder_cm',
    labelTh: 'ไหล่', labelEn: 'Shoulder',
    measureHintTh: 'วัดจากปลายไหล่ข้างหนึ่งถึงอีกข้าง',
    measureHintEn: 'Measure from one shoulder tip to the other.',
    categories: ['top', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'chest_cm',
    labelTh: 'รอบอก', labelEn: 'Chest',
    measureHintTh: 'วัดรอบส่วนที่กว้างที่สุดของอก',
    measureHintEn: 'Measure around the fullest part of the chest.',
    categories: ['top', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'waist_cm',
    labelTh: 'รอบเอว', labelEn: 'Waist',
    measureHintTh: 'วัดรอบส่วนที่แคบที่สุดของเอว',
    measureHintEn: 'Measure around the narrowest part of the waist.',
    categories: ['top', 'bottom', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'hip_cm',
    labelTh: 'รอบสะโพก', labelEn: 'Hip',
    measureHintTh: 'วัดรอบส่วนที่กว้างที่สุดของสะโพก',
    measureHintEn: 'Measure around the fullest part of the hips.',
    categories: ['bottom', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'length_cm',
    labelTh: 'ความยาว', labelEn: 'Length',
    measureHintTh: 'วัดจากบนสุดถึงล่างสุดของเสื้อผ้า',
    measureHintEn: 'Measure top to bottom of the garment.',
    categories: ['top', 'bottom', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
  {
    key: 'sleeve_cm',
    labelTh: 'ความยาวแขน', labelEn: 'Sleeve',
    measureHintTh: 'วัดจากไหล่ถึงข้อมือ',
    measureHintEn: 'Measure from shoulder to wrist.',
    categories: ['top', 'dress'],
    defaultBands: DEFAULT_BANDS,
  },
];

export function dimensionsForCategory(c: Category): Dimension[] {
  return DIMENSIONS.filter(d => d.categories.includes(c));
}

export function dimensionByKey(key: string): Dimension | undefined {
  return DIMENSIONS.find(d => d.key === key);
}
