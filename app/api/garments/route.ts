import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';
import { checkRulesetOwnership } from '@/lib/garment/ruleset-ownership';
import { parseColoursField, parseFabricField, isFabricEmpty } from '@/lib/garment/colour-fabric';
import { t } from '@/lib/i18n/strings';
import { PHOTO_BUCKET, uploadPhotoField, type PhotoUpload } from '@/lib/garment/photo-upload';
import { copyStoredObject } from '@/lib/garment/storage-copy';
import { loadProductContext, checkGarmentOwnership } from '@/lib/catalogue/ownership';
import { parsePicksField } from '@/lib/catalogue/parse';
import { checkPicksForWrite } from '@/lib/catalogue/version-write';
import { z } from 'zod';

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  // Every garment is a version of a product (garments.product_id is NOT NULL).
  // The product, its pickers and any copy_from garment are all read scoped to
  // the caller, so another shop's ids look nonexistent.
  const productIdRaw = String(form.get('product_id') ?? '').trim();
  if (!productIdRaw) return NextResponse.json({ error: 'product_id is required' }, { status: 400 });
  if (!z.uuid().safeParse(productIdRaw).success) return NextResponse.json({ error: 'invalid product_id' }, { status: 400 });
  const product = await loadProductContext(supabase, user.id, productIdRaw);
  if (!product.ok) return NextResponse.json({ error: product.error }, { status: product.status });
  form.set('name', product.ctx.name);
  const picksParse = parsePicksField(form.get('picks'), product.ctx.pickers.map(p => p.id));
  if (!picksParse.ok) return NextResponse.json({ error: picksParse.error }, { status: 400 });
  const writable = checkPicksForWrite(product.ctx, picksParse.picks);
  if (!writable.ok) return NextResponse.json({ error: writable.error }, { status: 400 });
  const productFields = { product_id: product.ctx.id, picks: picksParse.picks };

  // Duplicate: the files of this garment are copied (never shared) when the form sends no new file.
  let copySource: { photo_url: string | null; true_colour_photo_url: string | null; fabric_photo_url: string | null } | null = null;
  const copyFromRaw = String(form.get('copy_from') ?? '').trim();
  if (copyFromRaw) {
    if (!z.uuid().safeParse(copyFromRaw).success) return NextResponse.json({ error: 'invalid copy_from' }, { status: 400 });
    const own = await checkGarmentOwnership(supabase, user.id, copyFromRaw);
    if (!own.ok) return NextResponse.json({ error: own.error }, { status: own.status });
    const [{ data: g }, { data: f }] = await Promise.all([
      supabase.from('garments').select('photo_url, true_colour_photo_url').eq('id', copyFromRaw).eq('retailer_id', user.id).maybeSingle(),
      supabase.from('garment_fabric').select('fabric_photo_url').eq('garment_id', copyFromRaw).maybeSingle(),
    ]);
    copySource = {
      photo_url: g?.photo_url ?? null,
      true_colour_photo_url: g?.true_colour_photo_url ?? null,
      fabric_photo_url: f?.fabric_photo_url ?? null,
    };
  }

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const owned = await checkRulesetOwnership(supabase, user.id, parsed.data.fit_ruleset_id);
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status });

  const coloursParse = parseColoursField(form);
  if (!coloursParse.ok) return NextResponse.json({ error: coloursParse.error }, { status: 400 });

  const fabricParse = parseFabricField(form);
  if (!fabricParse.ok) return NextResponse.json({ error: fabricParse.error }, { status: 400 });

  // Photo is required on create, so it is checked here rather than in the
  // shared validator, which edit also uses and where it is optional.
  // uploadPhotoField() returns null for exactly the "absent or empty" case.
  let uploaded: PhotoUpload | null | 'failed' = await uploadPhotoField(supabase, user.id, form, 'photo');
  if (uploaded === null && copySource) {
    uploaded = await copyStoredObject(supabase, user.id, copySource.photo_url);
  }
  if (uploaded === null) {
    return NextResponse.json({ error: t.photoRequired.th }, { status: 400 });
  }
  if (uploaded === 'failed') {
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  const { url: publicUrl, path } = uploaded;

  // Every object uploaded so far, so a later failure can clean all of them up.
  const uploadedPaths: string[] = [path];

  let trueColour: PhotoUpload | null | 'failed' = await uploadPhotoField(supabase, user.id, form, 'true_colour_photo');
  if (trueColour === null && copySource) {
    trueColour = await copyStoredObject(supabase, user.id, copySource.true_colour_photo_url);
  }
  if (trueColour === 'failed') {
    await supabase.storage.from(PHOTO_BUCKET).remove(uploadedPaths).catch(() => {});
    return NextResponse.json({ error: t.photoUploadFailed.th }, { status: 500 });
  }
  if (trueColour) uploadedPaths.push(trueColour.path);

  let fabricPhoto: PhotoUpload | null | 'failed' = await uploadPhotoField(supabase, user.id, form, 'fabric_photo');
  if (fabricPhoto === null && copySource && fabricParse.present) {
    fabricPhoto = await copyStoredObject(supabase, user.id, copySource.fabric_photo_url);
  }
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
      ...productFields,
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
