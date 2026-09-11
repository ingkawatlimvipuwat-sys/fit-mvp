import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';
import { t } from '@/lib/i18n/strings';
import { PHOTO_BUCKET, pathFromPublicUrl, uploadPhotoField } from '@/lib/garment/photo-upload';

/**
 * Delete one object from the garment-photos bucket. Never throws: by the time
 * this runs the database is already correct, so an orphaned file is a far
 * smaller problem than a failed request. The owner-prefix check is what stops
 * a doctored photo_url aiming a service-role delete at another retailer.
 */
async function removeStoredObject(path: string, userId: string): Promise<void> {
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
async function removeStoredPhoto(photoUrl: string | null, userId: string): Promise<void> {
  const path = pathFromPublicUrl(photoUrl);
  if (path) await removeStoredObject(path, userId);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Ownership check and the current photo in one read. Scoping by retailer_id
  // means another shop's id is indistinguishable from a nonexistent one.
  const { data: existing } = await supabase
    .from('garments')
    .select('photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const form = await req.formData();

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Photo is the one field where absent means "keep what's there". Everything
  // in parsed.data is written unconditionally — this is a full replacement of
  // the editable columns, not a merge of whichever keys arrived. photo_url
  // itself is left untouched unless a new photo actually uploaded — writing
  // back a value read earlier in the request would risk clobbering a newer
  // photo_url from a concurrent save with a now-stale one.
  let newPhotoUrl: string | null = null;
  let uploadedPath: string | null = null;

  // Upload first, point the row at it second, delete the old one last. If
  // this fails nothing has changed and the original photo is intact.
  const uploaded = await uploadPhotoField(supabase, user.id, form, 'photo');
  if (uploaded === 'failed') {
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  if (uploaded) {
    newPhotoUrl = uploaded.url;
    uploadedPath = uploaded.path;
  }

  const { error: updErr } = await supabase
    .from('garments')
    .update(newPhotoUrl ? { ...parsed.data, photo_url: newPhotoUrl } : parsed.data)
    .eq('id', params.id)
    .eq('retailer_id', user.id);

  if (updErr) {
    console.error('garment update failed:', updErr);
    // Roll the upload back so a failed save leaves no stray file. The garment
    // still points at its original photo.
    if (uploadedPath) await removeStoredObject(uploadedPath, user.id);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  // Only now is the old object unreferenced.
  if (uploadedPath) await removeStoredPhoto(existing.photo_url, user.id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: garment } = await supabase
    .from('garments')
    .select('photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!garment) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { error: delErr } = await supabase
    .from('garments')
    .delete()
    .eq('id', params.id)
    .eq('retailer_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await removeStoredPhoto(garment.photo_url, user.id);

  return NextResponse.json({ ok: true });
}
