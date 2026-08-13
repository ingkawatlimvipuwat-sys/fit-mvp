import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseGarmentFields } from '@/lib/garment/parse-form';

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();

  const parsed = parseGarmentFields(form);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Photo is required on create, so it is checked here rather than in the
  // shared validator, which edit also uses and where it is optional.
  const photo = form.get('photo');
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: 'photo required' }, { status: 400 });
  }

  // Upload photo to Storage. Sanitize ext to a short alphanumeric token so
  // a hand-crafted filename can't introduce slashes or query strings into
  // the Storage object key.
  const rawExt = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const ext = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 10) || 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('garment-photos').upload(path, photo, {
    cacheControl: '3600', upsert: false, contentType: photo.type || 'image/jpeg',
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: { publicUrl } } = supabase.storage.from('garment-photos').getPublicUrl(path);

  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({ retailer_id: user.id, photo_url: publicUrl, ...parsed.data })
    .select('id')
    .single();
  if (insErr) {
    // Best-effort cleanup: remove the orphaned Storage file so the bucket
    // doesn't accumulate dead photos. Mirrors the signup route's orphan
    // cleanup at commit 13230c7. Failure of this cleanup is swallowed —
    // the user-facing error is what we return regardless.
    await supabase.storage.from('garment-photos').remove([path]).catch(() => {});
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: row.id });
}
