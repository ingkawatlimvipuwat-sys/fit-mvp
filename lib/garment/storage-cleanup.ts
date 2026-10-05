import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { PHOTO_BUCKET, pathFromPublicUrl } from '@/lib/garment/photo-upload';

/**
 * Delete one object from the garment-photos bucket. Never throws: by the time
 * this runs the database is already correct, so an orphaned file is a far
 * smaller problem than a failed request. The owner-prefix check is what stops
 * a doctored photo_url aiming a service-role delete at another retailer.
 */
export async function removeStoredObject(path: string, userId: string): Promise<void> {
  if (!path.startsWith(`${userId}/`)) return;
  const admin = createSupabaseAdminClient();
  try {
    const { error } = await admin.storage.from(PHOTO_BUCKET).remove([path]);
    if (error) console.error('storage cleanup failed (non-fatal):', error);
  } catch (e) {
    console.error('storage cleanup failed (non-fatal):', e);
  }
}

/** As removeStoredObject, but locating the object from a stored public URL. */
export async function removeStoredPhoto(photoUrl: string | null, userId: string): Promise<void> {
  const path = pathFromPublicUrl(photoUrl);
  if (path) await removeStoredObject(path, userId);
}
