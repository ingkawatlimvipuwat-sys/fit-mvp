import { subtreeIds, type FolderRow } from './folders';

/** What the dashboard is showing. Lives in the address bar (see viewToQuery). */
export interface DashboardView {
  /** null = All items. */
  folderId: string | null;
}

interface ParamsLike { get(name: string): string | null }

/** Read the view from the address bar. A folder that no longer exists, or is not the caller's, falls back to All items. */
export function parseView(params: ParamsLike, folders: FolderRow[]): DashboardView {
  const folder = params.get('folder');
  return { folderId: folder && folders.some(f => f.id === folder) ? folder : null };
}

/** The query string for a view, without the leading '?'. Empty for All items. */
export function viewToQuery(view: DashboardView): string {
  const p = new URLSearchParams();
  if (view.folderId) p.set('folder', view.folderId);
  return p.toString();
}

/**
 * The products a view shows, in the order given. All items = every product;
 * a folder = products in it or in any folder below it (open question 1).
 */
export function productsInView<T extends { folder_id: string | null }>(
  products: T[], folders: FolderRow[], view: DashboardView,
): T[] {
  if (view.folderId === null) return products;
  const ids = subtreeIds(folders, view.folderId);
  return products.filter(p => p.folder_id !== null && ids.has(p.folder_id));
}
