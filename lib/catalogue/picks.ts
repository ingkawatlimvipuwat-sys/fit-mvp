/** A version's picks, keyed by product_pickers.id. */
export type Picks = Record<string, string>;
export interface PickerDef { id: string; name: string; position: number }
export interface VersionPicks { id: string; picks: Picks; created_at: string }

export const normPick = (v: string | undefined | null): string => (v ?? '').trim().toLowerCase();

export function isComplete(picks: Picks, pickerIds: string[]): boolean {
  return pickerIds.every(id => normPick(picks[id]) !== '');
}

function keyOf(picks: Picks, pickerIds: string[]): string {
  return pickerIds.map(id => normPick(picks[id])).join('\u0000');
}

/** Rule 4: another version of the same product with the same picks, or null. */
export function findDuplicate<T extends VersionPicks>(
  versions: T[], candidate: Picks, pickerIds: string[], ignoreId?: string,
): T | null {
  const k = keyOf(candidate, pickerIds);
  return versions.find(x => x.id !== ignoreId && keyOf(x.picks, pickerIds) === k) ?? null;
}

/** "L / Black": display spellings, picker order, blanks skipped. */
export function versionLabel(picks: Picks, pickers: PickerDef[]): string {
  return [...pickers]
    .sort((a, b) => a.position - b.position)
    .map(p => (picks[p.id] ?? '').trim())
    .filter(Boolean)
    .join(' / ');
}

/** The one version a full selection names. Null for partial or non-existent selections. */
export function resolveVersion<T extends VersionPicks>(
  versions: T[], selection: Picks, pickerIds: string[],
): T | null {
  if (!isComplete(selection, pickerIds)) return null;
  return findDuplicate(versions, selection, pickerIds);
}

/**
 * Normalised values of `pickerId` that exist among COMPLETE versions consistent
 * with every OTHER picker the shopper has already chosen. The rest are greyed out.
 */
export function availableValues(
  versions: VersionPicks[], pickerIds: string[], selection: Picks, pickerId: string,
): Set<string> {
  const out = new Set<string>();
  for (const x of versions) {
    if (!isComplete(x.picks, pickerIds)) continue;
    const ok = pickerIds.every(id =>
      id === pickerId || normPick(selection[id]) === '' || normPick(selection[id]) === normPick(x.picks[id]));
    if (ok) out.add(normPick(x.picks[pickerId]));
  }
  return out;
}

/** Display values for one picker in the order the owner first used them (by created_at). */
export function valueOrder(versions: VersionPicks[], pickerId: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of [...versions].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const raw = (x.picks[pickerId] ?? '').trim();
    if (!raw || seen.has(normPick(raw))) continue;
    seen.add(normPick(raw));
    out.push(raw);
  }
  return out;
}

/** Pairs of versions that would become identical if the `removeId` picker were deleted. */
export function clashesAfterRemoval<T extends VersionPicks>(
  versions: T[], pickerIds: string[], removeId: string,
): [T, T][] {
  const rest = pickerIds.filter(id => id !== removeId);
  const pairs: [T, T][] = [];
  for (let i = 0; i < versions.length; i++) {
    for (let j = i + 1; j < versions.length; j++) {
      if (keyOf(versions[i].picks, rest) === keyOf(versions[j].picks, rest)) pairs.push([versions[i], versions[j]]);
    }
  }
  return pairs;
}

/** Per picker id, the values the product already uses, for the form's suggestions. */
export function usedValuesByPicker(versions: VersionPicks[], pickers: PickerDef[]): Record<string, string[]> {
  return Object.fromEntries(pickers.map(p => [p.id, valueOrder(versions, p.id)]));
}
