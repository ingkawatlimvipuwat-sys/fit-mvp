import type { SupabaseClient } from '@supabase/supabase-js';
import { PHOTO_BUCKET, pathFromPublicUrl, storageKeyFor, type PhotoUpload } from './photo-upload';

/**
 * Copy one stored object to a new path under the same owner and return the new
 * public URL and path. Null for a null/unreadable url, 'failed' on error or
 * when the source is not under the caller's own prefix (never copy another
 * shop's file). Duplicate never shares one URL between two versions: replacing
 * or deleting one version's photo must not break the other (spec 5.4).
 */
export async function copyStoredObject(
  supabase: SupabaseClient, userId: string, photoUrl: string | null,
): Promise<PhotoUpload | null | 'failed'> {
  const from = pathFromPublicUrl(photoUrl);
  if (!from) return null;
  if (!from.startsWith(`${userId}/`)) return 'failed';
  const to = storageKeyFor(userId, from);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).copy(from, to);
  if (error) {
    console.error('storage copy failed:', error);
    return 'failed';
  }
  return { url: supabase.storage.from(PHOTO_BUCKET).getPublicUrl(to).data.publicUrl, path: to };
}
