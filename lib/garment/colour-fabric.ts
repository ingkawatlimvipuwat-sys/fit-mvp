import { z } from 'zod';
import { t } from '@/lib/i18n/strings';

export const HEX = /^#[0-9a-fA-F]{6}$/;

export const FINISH    = ['matte', 'slight_sheen', 'glossy'] as const;
export const THICKNESS = ['thin', 'medium', 'thick'] as const;
export const STRETCH   = ['none', 'some', 'high'] as const;
export const FEEL      = ['soft', 'crisp', 'rough'] as const;

export type FabricChipKey = 'finish' | 'thickness' | 'stretch' | 'feel';

/** One source of chip options for the retailer form AND the shopper page. */
export const FABRIC_CHIPS = {
  finish: FINISH,
  thickness: THICKNESS,
  stretch: STRETCH,
  feel: FEEL,
} as const satisfies Record<FabricChipKey, readonly string[]>;

/**
 * Chip value to i18n key: ('finish','slight_sheen') -> 'finishSlightSheen'.
 * Derived rather than hand-written at each call site, so adding an enum value
 * cannot silently render a blank label.
 */
export function chipStringKey(group: FabricChipKey, value: string): string {
  const suffix = value
    .split('_')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return `${group}${suffix}`;
}

// .strict() everywhere: without it zod STRIPS unknown keys, so a misspelled
// field parses "successfully" with that value silently gone.
export const ColourSchema = z.object({
  hex: z.string().regex(HEX),
  name: z.string().trim().min(1).max(40),
}).strict();

/** Any length, including 0. No cap and no ordering: the founder rejected ranking. */
export const ColoursSchema = z.array(ColourSchema);

export type Colour = z.infer<typeof ColourSchema>;

/** '' and undefined both collapse to null — an empty input means "not said". */
const blank = (v: unknown): unknown => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  return v;
};

const optEnum = <T extends readonly [string, ...string[]]>(vals: T) =>
  z.preprocess(blank, z.enum(vals).nullable());

const optText = (max: number) =>
  z.preprocess(
    v => { const b = blank(v); return b === null ? null : String(b).trim(); },
    z.string().max(max).nullable(),
  );

const optInt = (min: number, max: number) =>
  z.preprocess(
    v => { const b = blank(v); return b === null ? null : Number(b); },
    z.number().int().min(min).max(max).nullable(),
  );

const optNum = (max: number) =>
  z.preprocess(
    v => { const b = blank(v); return b === null ? null : Number(b); },
    z.number().positive().max(max).nullable(),
  );

/**
 * Mirrors the garment_fabric CHECK constraints exactly. Where the two disagree
 * the database wins and the retailer gets a 500 instead of a readable message,
 * so keep them in step: weight_gsm and thread_count integer 1..2000,
 * pore_size_mm > 0 and numeric(6,3) so strictly under 1000.
 */
export const FabricSchema = z.object({
  finish:       optEnum(FINISH),
  thickness:    optEnum(THICKNESS),
  stretch:      optEnum(STRETCH),
  feel:         optEnum(FEEL),
  composition:  optText(200),
  weight_gsm:   optInt(1, 2000),
  construction: optText(200),
  thread_count: optInt(1, 2000),
  pore_size_mm: optNum(999.999),
  notes:        optText(2000),
}).strict();

export type Fabric = z.infer<typeof FabricSchema>;

/** The content fields, in form and display order. NOT garment_id/updated_at/photo. */
export const FABRIC_FIELDS = [
  'finish', 'thickness', 'stretch', 'feel',
  'composition', 'weight_gsm', 'construction', 'thread_count', 'pore_size_mm', 'notes',
] as const;

/**
 * True when the retailer said nothing about the fabric. Drives both hiding the
 * shopper's Fabric tab and deleting the row instead of storing an empty one.
 *
 * Deliberately iterates FABRIC_FIELDS rather than Object.values(): a row read
 * back from the database also carries garment_id, updated_at and
 * fabric_photo_url, which are always set and would make this permanently false.
 */
export function isFabricEmpty(f: object | null | undefined): boolean {
  if (!f) return true;
  // `object`, not Record<string, unknown>: an interface without an index
  // signature (GarmentFabric) is not assignable to Record, so every caller
  // holding a real database row would otherwise need its own cast. One cast
  // here beats one at each call site.
  const row = f as Record<string, unknown>;
  return FABRIC_FIELDS.every(k => {
    const v = row[k];
    return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
  });
}

/**
 * Absent field and empty value mean different things, so the result says which.
 * Colours are replace-all; reading an absent field as [] would let any caller
 * that does not know about colours wipe the retailer's whole list.
 */
export type ColoursParse =
  | { ok: true; present: false }
  | { ok: true; present: true; colours: Colour[] }
  | { ok: false; error: string };

export function parseColoursField(form: FormData): ColoursParse {
  const raw = form.get('colours');
  if (raw === null) return { ok: true, present: false };
  let json: unknown;
  try { json = JSON.parse(String(raw)); }
  catch { return { ok: false, error: t.colourInvalid.th }; }
  const parsed = ColoursSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: t.colourInvalid.th };
  return { ok: true, present: true, colours: parsed.data };
}

export type FabricParse =
  | { ok: true; present: false }
  | { ok: true; present: true; fabric: Fabric }
  | { ok: false; error: string };

export function parseFabricField(form: FormData): FabricParse {
  const raw = form.get('fabric');
  if (raw === null) return { ok: true, present: false };
  let json: unknown;
  try { json = JSON.parse(String(raw)); }
  catch { return { ok: false, error: t.fabricInvalid.th }; }
  const parsed = FabricSchema.safeParse(json);
  if (!parsed.success) return { ok: false, error: t.fabricInvalid.th };
  return { ok: true, present: true, fabric: parsed.data };
}
