import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { fitProfileByKey, FIT_PROFILES } from '@/lib/config/fit-profiles';
import type { Category, MeasurementBag } from '@/lib/supabase/types';

const CATEGORY = z.enum(['top', 'bottom', 'dress']);
const PROFILE_KEYS = FIT_PROFILES.map(p => p.key) as [string, ...string[]];

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const form = await req.formData();

  const name = String(form.get('name') ?? '').trim();
  const categoryRaw = String(form.get('category') ?? '');
  const fit_profile = String(form.get('fit_profile') ?? 'regular');
  const photo = form.get('photo');

  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const catParse = CATEGORY.safeParse(categoryRaw);
  if (!catParse.success) return NextResponse.json({ error: 'invalid category' }, { status: 400 });
  const category: Category = catParse.data;
  if (!(photo instanceof File) || photo.size === 0) {
    return NextResponse.json({ error: 'photo required' }, { status: 400 });
  }
  if (!z.enum(PROFILE_KEYS).safeParse(fit_profile).success) {
    return NextResponse.json({ error: 'invalid fit_profile' }, { status: 400 });
  }
  fitProfileByKey(fit_profile); // resolves or falls back; OK

  // Collect measurements only for dimensions this category uses
  const measurements: MeasurementBag = {};
  for (const d of dimensionsForCategory(category)) {
    const raw = form.get(d.key);
    if (raw === null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 300) {
      return NextResponse.json({ error: `invalid value for ${d.key}` }, { status: 400 });
    }
    measurements[d.key] = num;
  }

  // Upload photo to Storage
  const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('garment-photos').upload(path, photo, {
    cacheControl: '3600', upsert: false, contentType: photo.type || 'image/jpeg',
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  const { data: { publicUrl } } = supabase.storage.from('garment-photos').getPublicUrl(path);

  // Insert row
  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({ retailer_id: user.id, name, category, fit_profile, photo_url: publicUrl, measurements })
    .select('id')
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: row.id });
}
