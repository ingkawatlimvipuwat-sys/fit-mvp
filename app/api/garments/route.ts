import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';
import { t } from '@/lib/i18n/strings';
import { PHOTO_BUCKET, uploadPhotoField } from '@/lib/garment/photo-upload';

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

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

  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({ retailer_id: user.id, photo_url: publicUrl, ...parsed.data })
    .select('id')
    .single();
  if (insErr) {
    console.error('garment insert failed:', insErr);
    // Best-effort cleanup: remove the orphaned Storage file so the bucket
    // doesn't accumulate dead photos. Mirrors the signup route's orphan
    // cleanup at commit 13230c7. Failure of this cleanup is swallowed —
    // the user-facing error is what we return regardless.
    await supabase.storage.from(PHOTO_BUCKET).remove([path]).catch(() => {});
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: row.id });
}
