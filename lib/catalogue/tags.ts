export interface TagRow { id: string; name: string }
export interface ProductTagRow { product_id: string; tag_id: string }

/** Tags compare trimmed and case-insensitively, like the database's unique index on lower(name). */
export const normTag = (s: string): string => s.normalize('NFC').trim().toLowerCase();

const byName = (a: TagRow, b: TagRow) =>
  a.name.localeCompare(b.name, ['th', 'en'], { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

export function findTagByName(tags: TagRow[], name: string): TagRow | null {
  const n = normTag(name);
  return tags.find(tag => normTag(tag.name) === n) ?? null;
}

/** One product's tags, A–Z. Links to ids outside `tags` (the caller's own) are ignored. */
export function tagsOfProduct(productId: string, tags: TagRow[], links: ProductTagRow[]): TagRow[] {
  const ids = new Set(links.filter(l => l.product_id === productId).map(l => l.tag_id));
  return tags.filter(tag => ids.has(tag.id)).sort(byName);
}

/** The shop's tags that are on at least one product, A–Z. A tag on no product is hidden everywhere. */
export function tagsInUse(tags: TagRow[], links: ProductTagRow[]): TagRow[] {
  const used = new Set(links.map(l => l.tag_id));
  return tags.filter(tag => used.has(tag.id)).sort(byName);
}

/** Suggestions while typing on a product page: tags in use that this product does not have yet. */
export function tagSuggestions(inUse: TagRow[], attached: TagRow[]): TagRow[] {
  const on = new Set(attached.map(tag => tag.id));
  return inUse.filter(tag => !on.has(tag.id));
}

export interface TagUsage extends TagRow { count: number }

/** Every one of the shop's tags, used or not, A–Z, with how many products carry it (Manage tags). Links to ids outside `tags` are ignored. */
export function tagUsage(tags: TagRow[], links: ProductTagRow[]): TagUsage[] {
  const products = new Map<string, Set<string>>();
  for (const l of links) {
    const set = products.get(l.tag_id) ?? new Set<string>();
    set.add(l.product_id);
    products.set(l.tag_id, set);
  }
  return [...tags].sort(byName).map(tag => ({ ...tag, count: products.get(tag.id)?.size ?? 0 }));
}

/** Another of the shop's tags already called `name` (compared like the unique index), or null. */
export function tagNameClash(tags: TagRow[], tagId: string, name: string): TagRow | null {
  const n = normTag(name);
  return tags.find(tag => tag.id !== tagId && normTag(tag.name) === n) ?? null;
}
