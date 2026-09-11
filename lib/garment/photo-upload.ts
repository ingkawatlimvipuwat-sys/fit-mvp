import type { SupabaseClient } from '@supabase/supabase-js';

export const PHOTO_BUCKET = 'garment-photos';
export const STORAGE_PREFIX = `/object/public/${PHOTO_BUCKET}/`;

/**
 * The Storage object key for a new upload. The extension is sanitised to a
 * short alphanumeric token so a hand-crafted filename cannot introduce slashes
 * or query strings into the key. The uuid makes it collision-free, and the
 * owner-id prefix is what removeStoredObject()'s ownership check relies on.
 */
export function storageKeyFor(userId: string, filename: string): string {
  const dotIdx = filename.lastIndexOf('.');
  const rawExt = dotIdx === -1 ? '' : filename.slice(dotIdx + 1).toLowerCase();
  const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
  return `${userId}/${crypto.randomUUID()}.${ext}`;
}

/** The object path inside the bucket, from a stored public URL. Null if unreadable. */
export function pathFromPublicUrl(photoUrl: string | null): string | null {
  if (!photoUrl) return null;
  const idx = photoUrl.indexOf(STORAGE_PREFIX);
  if (idx === -1) return null;
  try {
    // A malformed %-escape must not throw out of here.
    return decodeURIComponent(photoUrl.slice(idx + STORAGE_PREFIX.length));
  } catch {
    console.error('unreadable photo_url; skipping cleanup');
    return null;
  }
}

export type PhotoUpload = { url: string; path: string };

/**
 * Upload one optional file field. Returns null when the field is absent or
 * empty — which the caller MUST treat as "leave the column alone", never as
 * "set it to null". Writing back a URL read earlier in the request is exactly
 * the concurrency bug that was fixed on the garment edit page.
 *
 * Throws nothing: a failed upload returns 'failed' so the caller can map it to
 * its own error response.
 */
export async function uploadPhotoField(
  supabase: SupabaseClient,
  userId: string,
  form: FormData,
  field: string,
): Promise<PhotoUpload | null | 'failed'> {
  const file = form.get(field);
  if (!(file instanceof File) || file.size === 0) return null;

  const path = storageKeyFor(userId, file.name);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: '3600', upsert: false, contentType: file.type || 'image/jpeg',
  });
  if (error) {
    console.error(`${field} upload failed:`, error);
    return 'failed';
  }
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
