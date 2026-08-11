import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { t } from '@/lib/i18n/strings';
import { FitRulesetSchema, firstIssueMessage } from '@/lib/fit/rule-schema';
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
  const fitRulesetIdRaw = String(form.get('fit_ruleset_id') ?? '').trim();
  const overrideRaw = String(form.get('fit_rule_override') ?? '').trim();
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

  // These two are mutually exclusive by construction, not just by convention:
  // an inline override always clears any preset reference.
  let fit_rule_override: unknown = null;
  let fit_ruleset_id: string | null = null;

  if (overrideRaw) {
    let overrideJson: unknown;
    try { overrideJson = JSON.parse(overrideRaw); }
    catch { return NextResponse.json({ error: 'ข้อมูลกฎไม่ถูกต้อง' }, { status: 400 }); }
    const parsed = FitRulesetSchema.safeParse(overrideJson);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }
    fit_rule_override = parsed.data;
  } else if (fitRulesetIdRaw) {
    if (!z.uuid().safeParse(fitRulesetIdRaw).success) {
      return NextResponse.json({ error: 'invalid fit_ruleset_id' }, { status: 400 });
    }
    fit_ruleset_id = fitRulesetIdRaw;
  }

  // Collect measurements only for dimensions this category uses
  const measurements: MeasurementBag = {};
  for (const d of dimensionsForCategory(category)) {
    const raw = form.get(d.key);
    if (raw === null || raw === '') continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0 || num > 300) {
      return NextResponse.json({ error: `ค่าไม่ถูกต้อง: ${d.labelTh}` }, { status: 400 });
    }
    measurements[d.key] = num;
  }
  if (Object.keys(measurements).length === 0) {
    return NextResponse.json({ error: t.garmentNeedsMeasurement.th }, { status: 400 });
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

  // Insert row
  const { data: row, error: insErr } = await supabase
    .from('garments')
    .insert({
      retailer_id: user.id, name, category, fit_profile,
      photo_url: publicUrl, measurements,
      fit_ruleset_id, fit_rule_override,
    })
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
