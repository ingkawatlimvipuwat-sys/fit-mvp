import { FABRIC_CHIPS, isFabricEmpty, type FabricChipKey } from './colour-fabric';
import type { GarmentFabric } from '@/lib/supabase/types';

/** The Colour tab exists only if there is something to show inside it. */
export function showColourTab(colours: unknown[], trueColourPhotoUrl: string | null): boolean {
  return colours.length > 0 || !!trueColourPhotoUrl;
}

/**
 * A fabric row can legitimately exist while saying nothing: it survives if the
 * text fields are cleared while a photo remains, and removing that photo later
 * can leave it all-null. An empty tab would be worse than no tab.
 */
export function showFabricTab(fabric: GarmentFabric | null): boolean {
  if (!fabric) return false;
  // isFabricEmpty takes Record<string, unknown>; GarmentFabric has no index
  // signature, so the shapes need this bridge even though every field lines up.
  return !isFabricEmpty(fabric as unknown as Record<string, unknown>) || !!fabric.fabric_photo_url;
}

export interface Chip { group: FabricChipKey; value: string }

/** The simple tier, in a fixed order, with only the groups the retailer set. */
export function visibleChips(fabric: GarmentFabric | null): Chip[] {
  if (!fabric) return [];
  const chips: Chip[] = [];
  for (const group of Object.keys(FABRIC_CHIPS) as FabricChipKey[]) {
    const value = fabric[group];
    if (typeof value === 'string' && value.trim() !== '') {
      chips.push({ group, value });
    }
  }
  return chips;
}

/** Technical-tier fields, in display order. Not chips, not the photo. */
export const TECHNICAL_FIELDS = [
  'composition', 'weight_gsm', 'construction', 'thread_count', 'pore_size_mm', 'notes',
] as const;

export type TechnicalField = (typeof TECHNICAL_FIELDS)[number];
export interface TechnicalRow { key: TechnicalField; value: string }

/** Only rows with a value. Values are the retailer's own words, shown as-is. */
export function technicalRows(fabric: GarmentFabric | null): TechnicalRow[] {
  if (!fabric) return [];
  return TECHNICAL_FIELDS
    .map(key => {
      const raw = fabric[key];
      return { key, value: raw === null || raw === undefined ? '' : String(raw).trim() };
    })
    .filter(r => r.value !== '');
}

/** Up to `cap` dots on a shop-grid card, then a "+n" marker. */
export function dotsWithOverflow<T>(colours: T[], cap = 6): { shown: T[]; extra: number } {
  return { shown: colours.slice(0, cap), extra: Math.max(0, colours.length - cap) };
}
