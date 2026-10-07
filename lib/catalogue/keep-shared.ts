/**
 * When the shopper switches to a version of a different garment type, keep what
 * they typed for the dimensions both ask for and drop the rest (spec §6).
 */
export function keepSharedValues(values: Record<string, string>, newKeys: string[]): Record<string, string> {
  const keep = new Set(newKeys);
  return Object.fromEntries(Object.entries(values).filter(([k]) => keep.has(k)));
}
