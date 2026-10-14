import { subtreeIds, type FolderRow } from './folders';

export type SortKey = 'newest' | 'oldest' | 'az' | 'za';
const SORTS: readonly SortKey[] = ['newest', 'oldest', 'az', 'za'];

/** What the dashboard is showing. Lives in the address bar (see viewToQuery). */
export interface DashboardView {
  /** null = All items. */
  folderId: string | null;
  /** As typed (matching trims it). */
  q: string;
  /** Products must have ALL of these (spec §5.1). */
  tagIds: string[];
  sort: SortKey;
  /** ⚠ Needs attention only. */
  attention: boolean;
}
export const DEFAULT_VIEW: DashboardView = { folderId: null, q: '', tagIds: [], sort: 'newest', attention: false };

/** What productsInView needs from a card (ProductSummary has all of it). */
export interface ViewProduct {
  id: string; name: string; created_at: string; folder_id: string | null;
  needsAttention: boolean; tags: { id: string }[];
}

interface ParamsLike { get(name: string): string | null }

/**
 * Read the view from the address bar. Unknown folders (deleted, or another
 * shop's) fall back to All items; unknown tag ids and sorts are dropped.
 */
export function parseView(params: ParamsLike, folders: FolderRow[], knownTagIds: string[]): DashboardView {
  const folder = params.get('folder');
  const known = new Set(knownTagIds);
  const sort = params.get('sort') as SortKey | null;
  return {
    folderId: folder && folders.some(f => f.id === folder) ? folder : null,
    q: (params.get('q') ?? '').slice(0, 100),
    tagIds: [...new Set((params.get('tags') ?? '').split(',').filter(id => known.has(id)))],
    sort: sort !== null && SORTS.includes(sort) ? sort : 'newest',
    attention: params.get('attention') === '1',
  };
}

/** The query string for a view, without the leading '?'. Empty for the default view. */
export function viewToQuery(view: DashboardView): string {
  const p = new URLSearchParams();
  if (view.folderId) p.set('folder', view.folderId);
  if (view.q.trim()) p.set('q', view.q);
  if (view.tagIds.length > 0) p.set('tags', view.tagIds.join(','));
  if (view.sort !== 'newest') p.set('sort', view.sort);
  if (view.attention) p.set('attention', '1');
  return p.toString();
}

const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();

/** Product-name search: trimmed, case-insensitive substring. A blank search matches everything. */
export function matchesSearch(name: string, q: string): boolean {
  const n = norm(q);
  return n === '' || norm(name).includes(n);
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, ['th', 'en'], { sensitivity: 'base', numeric: true });

/** A sorted copy. Ties fall back to newest first, then id, so the order is stable. */
export function sortProducts<T extends { id: string; name: string; created_at: string }>(products: T[], sort: SortKey): T[] {
  const newest = (a: T, b: T) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  const cmp: (a: T, b: T) => number =
    sort === 'newest' ? newest
    : sort === 'oldest' ? (a, b) => newest(b, a)
    : sort === 'az' ? (a, b) => byName(a, b) || newest(a, b)
    : (a, b) => byName(b, a) || newest(a, b);
  return [...products].sort(cmp);
}

/** Search, tags or ⚠ is on (folder and sort are not "filters" for the empty-state text). */
export const isFiltered = (v: DashboardView): boolean => v.q.trim() !== '' || v.tagIds.length > 0 || v.attention;

/**
 * The cards a view shows. Folder scope: All items = every product; a folder =
 * products in it or any folder below it (open question 1). Search, tags and
 * ⚠ apply within that scope (spec §5.1). Then sorted.
 */
export function productsInView<T extends ViewProduct>(products: T[], folders: FolderRow[], view: DashboardView): T[] {
  const scope = view.folderId === null ? null : subtreeIds(folders, view.folderId);
  return sortProducts(products.filter(p =>
    (scope === null || (p.folder_id !== null && scope.has(p.folder_id)))
    && matchesSearch(p.name, view.q)
    && view.tagIds.every(id => p.tags.some(tag => tag.id === id))
    && (!view.attention || p.needsAttention),
  ), view.sort);
}
