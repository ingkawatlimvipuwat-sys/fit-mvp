import type { Picks } from './picks';

type Named = { ok: true; value: string } | { ok: false; error: string };

function named(raw: unknown, max: number, error: string): Named {
  const value = String(raw ?? '').trim();
  return value.length >= 1 && value.length <= max ? { ok: true, value } : { ok: false, error };
}

export const parseProductName = (raw: unknown) => named(raw, 120, 'invalid product name');
export const parsePickerName = (raw: unknown) => named(raw, 30, 'invalid picker name');

/**
 * The `picks` form field: a JSON object keyed by picker id. Every key must be
 * one of the product's own pickers, so another shop's picker id is rejected.
 * Empty or absent means no picks.
 */
export function parsePicksField(raw: unknown, pickerIds: string[]):
  { ok: true; picks: Picks } | { ok: false; error: string } {
  const text = String(raw ?? '').trim();
  if (!text) return { ok: true, picks: {} };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: 'invalid picks' }; }
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return { ok: false, error: 'invalid picks' };
  const allowed = new Set(pickerIds);
  const picks: Picks = {};
  for (const [k, v] of Object.entries(json)) {
    if (!allowed.has(k)) return { ok: false, error: 'invalid picks' };
    if (typeof v !== 'string' || v.trim().length > 60) return { ok: false, error: 'invalid picks' };
    picks[k] = v.trim();
  }
  return { ok: true, picks };
}
