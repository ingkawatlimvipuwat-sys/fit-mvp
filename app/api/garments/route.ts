import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';
import { parseColoursField, parseFabricField, isFabricEmpty } from '@/lib/garment/colour-fabric';
import { t } from '@/lib/i18n/strings';
import { PHOTO_BUCKET, uploadPhotoField } from '@/lib/garment/photo-upload';

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const coloursParse = parseColoursField(form);
  if (!coloursParse.ok) return NextResponse.json({ error: coloursParse.error }, { status: 400 });

  const fabricParse = parseFabricField(form);
  if (!fabricParse.ok) return NextResponse.json({ error: fabricParse.error }, { status: 400 });

  // Photo is required on create, so it is checked here rather than in the
  // shared validator, which edit also uses and where it is optional.
  // uploadPhotoField() returns null for exactly the "absent or empty" case.
  const uploaded = await uploadPhotoField(supabase, user.id, form, 'photo');
  if (uploaded === null) {
    return NextResponse.json({ error: t.photoRequired.th }, { status: 400 });
  }
  if (uploaded === 'failed') {
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  const { url: publicUrl, path } = uploaded;

  // Every object uploaded so far, so a later failure can clean all of them up.
  const uploadedPaths: string[] = [path];

  const trueColour = await uploadPhotoField(supabase, user.id, form, 'true_colour_photo');
  if (trueColour === 'failed') {
    await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  if (trueColour) uploadedPaths.push(trueColour.path);

  const fabricPhoto = await uploadPhotoField(supabase, user.id, form, 'fabric_photo');
  if (fabricPhoto === 'failed') {
    await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  if (fabricPhoto) uploadedPaths.push(fabricPhoto.path);

  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({
      retailer_id: user.id,
      photo_url: publicUrl,
      // Omit the key entirely when there is no photo rather than writing null:
      // the column default is null anyway, and this keeps the insert payload
      // identical to today's for a garment with no true-colour photo.
      ...(trueColour ? { true_colour_photo_url: trueColour.url } : {}),
      ...parsed.data,
    })
    .select('id')
    .single();
  if (insErr) {
    console.error('garment insert failed:', insErr);
    // Best-effort cleanup: remove the orphaned Storage file(s) so the bucket
    // doesn't accumulate dead photos. Mirrors the signup route's orphan
    // cleanup at commit 13230c7. Failure of this cleanup is swallowed —
    // the user-facing error is what we return regardless.
    await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  // A failure here leaves a saved garment with incomplete colour or fabric data
  // rather than losing the garment: the retailer can simply re-save. Deleting
  // the garment to "roll back" would be the worse trade — they just uploaded a
  // photo and filled in a form.
  if (coloursParse.present && coloursParse.colours.length > 0) {
    const { error } = await supabase.from('garment_colours').insert(
      coloursParse.colours.map(c => ({ garment_id: row.id, hex: c.hex, name: c.name })),
    );
    if (error) console.error('garment_colours insert failed (non-fatal):', error);
  }

  const fabric = fabricParse.present ? fabricParse.fabric : null;
  if (fabric && (!isFabricEmpty(fabric) || fabricPhoto)) {
    const { error } = await supabase.from('garment_fabric').insert({
      garment_id: row.id,
      ...fabric,
      ...(fabricPhoto ? { fabric_photo_url: fabricPhoto.url } : {}),
    });
    if (error) console.error('garment_fabric insert failed (non-fatal):', error);
  }

  return NextResponse.json({ ok: true, id: row.id });
}
