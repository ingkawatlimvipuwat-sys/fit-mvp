import { t } from '@/lib/i18n/strings';
import { findDuplicate, versionLabel, type PickerDef, type Picks, type VersionPicks } from './picks';

export function nextPosition(pickers: PickerDef[]): number {
  return pickers.length === 0 ? 0 : Math.max(...pickers.map(p => p.position)) + 1;
}

/**
 * The values the owner types for existing versions when adding a picker:
 * { versionId: value }. Only this product's version ids are allowed; blanks are
 * dropped (skipped, spec 5.2).
 */
export function parseBackfill(raw: unknown, versionIds: string[]):
  { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, values: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'invalid values' };
  const known = new Set(versionIds);
  const values: Record<string, string> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(id) || typeof v !== 'string' || v.trim().length > 60) return { ok: false, error: 'invalid values' };
    if (v.trim() !== '') values[id] = v.trim();
  }
  return { ok: true, values };
}

/**
 * Which versions get a value for a new picker, and whether that keeps rule 4.
 * `updates` lists only versions whose picks change.
 */
export function planAddPicker(
  ctx: { pickers: PickerDef[]; versions: VersionPicks[] },
  newPickerId: string,
  values: Record<string, string>,
): { ok: true; updates: { id: string; picks: Picks }[] } | { ok: false; error: string } {
  const after = ctx.versions.map(v =>
    v.id in values ? { ...v, picks: { ...v.picks, [newPickerId]: values[v.id] } } : v);
  const ids = [...ctx.pickers.map(p => p.id), newPickerId];
  const allPickers = [...ctx.pickers, { id: newPickerId, name: '', position: nextPosition(ctx.pickers) }];

  for (const v of after) {
    const clash = findDuplicate(after, v.picks, ids, v.id);
    if (clash) return { ok: false, error: t.duplicatePicks.th.replace('{label}', versionLabel(clash.picks, allPickers)) };
  }
  return { ok: true, updates: after.filter(v => v.id in values).map(v => ({ id: v.id, picks: v.picks })) };
}
