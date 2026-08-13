import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';

const STORAGE_PREFIX = '/object/public/garment-photos/';

/**
 * Best-effort removal of a garment photo from Storage.
 *
 * Never throws. By the time this runs the database is already correct, so an
 * orphaned file is a far smaller problem than a failed request. The
 * owner-prefix check stops a doctored photo_url from aiming the delete at
 * another retailer's object.
 */
async function removeStoredPhoto(photoUrl: string | null, userId: string): Promise<void> {
  if (!photoUrl) return;
  const idx = photoUrl.indexOf(STORAGE_PREFIX);
  if (idx === -1) return;
  const path = decodeURIComponent(photoUrl.slice(idx + STORAGE_PREFIX.length));
  if (!path.startsWith(`${userId}/`)) return;

  const admin = createSupabaseAdminClient();
  try {
    const { error } = await admin.storage.from('garment-photos').remove([path]);
    if (error) console.error('storage cleanup failed (non-fatal):', error);
  } catch (e) {
    console.error('storage cleanup failed (non-fatal):', e);
  }
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
  // the editable columns, not a merge of whichever keys arrived.
  let photo_url: string = existing.photo_url;
  let uploadedPath: string | null = null;

  const photo = form.get('photo');
  if (photo instanceof File && photo.size > 0) {
    // Same ext sanitisation as POST: a hand-crafted filename must not be able
    // to introduce slashes or query strings into the Storage object key.
    const rawExt = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
    uploadedPath = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from('garment-photos')
      .upload(uploadedPath, photo, {
        cacheControl: '3600', upsert: false, contentType: photo.type || 'image/jpeg',
      });
    // Upload first, point the row at it second, delete the old one last. If
    // this fails nothing has changed and the original photo is intact.
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    photo_url = supabase.storage.from('garment-photos').getPublicUrl(uploadedPath).data.publicUrl;
  }

  const { error: updErr } = await supabase
    .from('garments')
    .update({ ...parsed.data, photo_url })
    .eq('id', params.id)
    .eq('retailer_id', user.id);

  if (updErr) {
    // Roll the upload back so a failed save leaves no stray file. The garment
    // still points at its original photo.
    if (uploadedPath) {
      await supabase.storage.from('garment-photos').remove([uploadedPath]).catch(() => {});
    }
    return NextResponse.json({ error: updErr.message }, { status: 500 });
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
