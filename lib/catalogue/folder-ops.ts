import type { SupabaseClient } from '@supabase/supabase-js';
import { t } from '@/lib/i18n/strings';
import { wouldCreateCycle, type FolderRow } from './folders';

export type OpResult = { ok: true } | { ok: false; status: 404 | 409 | 500; error: string };

/**
 * Can folder `id` move under `newParentId` (null = top level)? `folders` must be
 * the caller's own folders (loadShopFolders, scoped by retailer_id), so another
 * shop's id — as the folder or the destination — is a 404, exactly like a
 * nonexistent one. Rule 5 (into itself or below itself) is a 409.
 */
export function checkFolderMove(folders: FolderRow[], id: string, newParentId: string | null): OpResult {
  if (!folders.some(f => f.id === id)) return { ok: false, status: 404, error: t.itemNotFound.th };
  if (newParentId !== null && !folders.some(f => f.id === newParentId)) {
    return { ok: false, status: 404, error: t.itemNotFound.th };
  }
  if (wouldCreateCycle(folders, id, newParentId)) return { ok: false, status: 409, error: t.folderCycle.th };
  return { ok: true };
}

/**
 * Rule 6: delete a folder without deleting anything in it. Its subfolders and
 * products move up one level (to its parent, or the top level), THEN the
 * folder row is deleted. Three statements, not a transaction: the order means
 * a failure part-way loses nothing (moved items are simply already moved, and
 * a retry finishes the job). The database also refuses the final delete while
 * any subfolder still points at it (folders.parent_id has no ON DELETE action).
 * `folder` must come from loadShopFolders (the caller's own).
 */
export async function deleteFolderMovingUp(
  supabase: SupabaseClient, userId: string, folder: FolderRow,
): Promise<OpResult> {
  const up = folder.parent_id;
  const fail = (step: string, error: unknown): OpResult => {
    console.error(`folder delete: ${step} failed:`, error);
    return { ok: false, status: 500, error: t.saveFailed.th };
  };

  const { error: foldersErr } = await supabase
    .from('folders').update({ parent_id: up }).eq('parent_id', folder.id).eq('retailer_id', userId);
  if (foldersErr) return fail('moving subfolders up', foldersErr);

  const { error: productsErr } = await supabase
    .from('products').update({ folder_id: up }).eq('folder_id', folder.id).eq('retailer_id', userId);
  if (productsErr) return fail('moving products up', productsErr);

  const { error: deleteErr } = await supabase
    .from('folders').delete().eq('id', folder.id).eq('retailer_id', userId);
  if (deleteErr) return fail('deleting the folder', deleteErr);

  return { ok: true };
}
