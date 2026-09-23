import { NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';
import { parseColoursField, parseFabricField, isFabricEmpty } from '@/lib/garment/colour-fabric';
import { t } from '@/lib/i18n/strings';
import { PHOTO_BUCKET, pathFromPublicUrl, uploadPhotoField, type PhotoUpload } from '@/lib/garment/photo-upload';

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
    .select('photo_url, true_colour_photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Needed to decide delete-vs-update below, and to know whether a fabric photo
  // already exists when every text field has been cleared.
  const { data: existingFabric } = await supabase
    .from('garment_fabric')
    .select('garment_id, fabric_photo_url')
    .eq('garment_id', params.id)
    .maybeSingle();

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const coloursParse = parseColoursField(form);
  if (!coloursParse.ok) return NextResponse.json({ error: coloursParse.error }, { status: 400 });
  const fabricParse = parseFabricField(form);
  if (!fabricParse.ok) return NextResponse.json({ error: fabricParse.error }, { status: 400 });

  // Photo is the one field where absent means "keep what's there". Everything
  // in parsed.data is written unconditionally — this is a full replacement of
  // the editable columns, not a merge of whichever keys arrived. photo_url
  // itself is left untouched unless a new photo actually uploaded — writing
  // back a value read earlier in the request would risk clobbering a newer
  // photo_url from a concurrent save with a now-stale one.

  // Upload first, point the row(s) at it second, delete the old ones last. If
  // this fails nothing has changed and the original photos are intact.
  const hero       = await uploadPhotoField(supabase, user.id, form, 'photo');
  const trueColour = await uploadPhotoField(supabase, user.id, form, 'true_colour_photo');
  const fabricPic  = await uploadPhotoField(supabase, user.id, form, 'fabric_photo');

  const uploadedPaths = [hero, trueColour, fabricPic]
    .filter((u): u is PhotoUpload => u !== null && u !== 'failed')
    .map(u => u.path);

  if (hero === 'failed' || trueColour === 'failed' || fabricPic === 'failed') {
    if (uploadedPaths.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    }
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }

  const { error: updErr } = await supabase
    .from('garments')
    .update({
      ...parsed.data,
      ...(hero ? { photo_url: hero.url } : {}),
      ...(trueColour ? { true_colour_photo_url: trueColour.url } : {}),
    })
    .eq('id', params.id)
    .eq('retailer_id', user.id);

  if (updErr) {
    console.error('garment update failed:', updErr);
    // Roll the uploads back so a failed save leaves no stray files. The
    // garment still points at its original photos.
    await Promise.all(uploadedPaths.map(p => removeStoredObject(p, user.id)));
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  // Replace-all: the submitted list IS the truth. Only when the field was
  // actually present — an absent field must not delete anything (Rule 2).
  if (coloursParse.present) {
    const { error: delErr } = await supabase
      .from('garment_colours').delete().eq('garment_id', params.id);
    if (delErr) console.error('garment_colours delete failed (non-fatal):', delErr);
    else if (coloursParse.colours.length > 0) {
      const { error } = await supabase.from('garment_colours').insert(
        coloursParse.colours.map(c => ({ garment_id: params.id, hex: c.hex, name: c.name })),
      );
      if (error) console.error('garment_colours insert failed (non-fatal):', error);
    }
  }

  if (fabricParse.present) {
    const fabric = fabricParse.fabric;
    // A cleared-out fabric still has a reason to exist if it holds a photo.
    const photoUrl = fabricPic ? fabricPic.url : existingFabric?.fabric_photo_url ?? null;

    if (isFabricEmpty(fabric) && !photoUrl) {
      const { error } = await supabase
        .from('garment_fabric').delete().eq('garment_id', params.id);
      if (error) console.error('garment_fabric delete failed (non-fatal):', error);
    } else if (existingFabric) {
      // Deliberately an explicit update, NOT .upsert(). PostgREST's ON CONFLICT
      // column set is not obvious, and guessing it wrong would silently drop the
      // existing fabric_photo_url whenever the retailer saved without picking a
      // new file. Spreading the photo key only when a file arrived keeps the
      // KEEP semantics exact.
      const { error } = await supabase
        .from('garment_fabric')
        .update({
          ...fabric,
          ...(fabricPic ? { fabric_photo_url: fabricPic.url } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq('garment_id', params.id);
      if (error) console.error('garment_fabric update failed (non-fatal):', error);
    } else {
      const { error } = await supabase.from('garment_fabric').insert({
        garment_id: params.id,
        ...fabric,
        ...(fabricPic ? { fabric_photo_url: fabricPic.url } : {}),
      });
      if (error) console.error('garment_fabric insert failed (non-fatal):', error);
    }
  }

  // Only now are the replaced objects unreferenced.
  if (hero) await removeStoredPhoto(existing.photo_url, user.id);
  if (trueColour) await removeStoredPhoto(existing.true_colour_photo_url, user.id);
  // A fabric photo can only be cleaned up if something was actually written to
  // point at the new one. When `fabric` was absent, Rule 2 skipped the whole
  // fabric block, so nothing references the upload: delete the orphan and leave
  // the old photo alone. Deleting the old one here would leave the surviving row
  // pointing at a destroyed object — a permanently broken image.
  if (fabricPic && !fabricParse.present) {
    await removeStoredObject(fabricPic.path, user.id);
  } else if (fabricPic && existingFabric?.fabric_photo_url) {
    await removeStoredPhoto(existingFabric.fabric_photo_url, user.id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: garment } = await supabase
    .from('garments')
    .select('photo_url, true_colour_photo_url')
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .single();
  if (!garment) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // Read this BEFORE the delete: the cascade destroys the row that names it.
  const { data: fabricRow } = await supabase
    .from('garment_fabric')
    .select('fabric_photo_url')
    .eq('garment_id', params.id)
    .maybeSingle();

  const { error: delErr } = await supabase
    .from('garments')
    .delete()
    .eq('id', params.id)
    .eq('retailer_id', user.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  await removeStoredPhoto(garment.photo_url, user.id);
  await removeStoredPhoto(garment.true_colour_photo_url, user.id);
  await removeStoredPhoto(fabricRow?.fabric_photo_url ?? null, user.id);

  return NextResponse.json({ ok: true });
}
