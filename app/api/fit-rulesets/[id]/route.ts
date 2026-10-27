import { NextResponse } from 'next/server';
import { t } from '@/lib/i18n/strings';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FitRulesetSchema, RulesetNameSchema, firstIssueMessage } from '@/lib/fit/rule-schema';

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const patch: { name?: string; rule?: unknown } = {};

  if (body.name !== undefined) {
    const name = RulesetNameSchema.safeParse(body.name);
    if (!name.success) return NextResponse.json({ error: 'ชื่อกฎไม่ถูกต้อง' }, { status: 400 });
    patch.name = name.data;
  }
  if (body.rule !== undefined) {
    const rule = FitRulesetSchema.safeParse(body.rule);
    if (!rule.success) {
      return NextResponse.json({ error: firstIssueMessage(rule.error) }, { status: 400 });
    }
    patch.rule = rule.data;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'ไม่มีข้อมูลให้แก้ไข' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fit_rulesets')
    .update(patch)
    .eq('id', params.id)
    .eq('retailer_id', user.id)
    .select('id, name, rule, created_at')
    .single();
  if (error) {
    console.error('fit_rulesets update failed:', error.message);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: t.itemNotFound.th }, { status: 404 });

  return NextResponse.json({ ok: true, ruleset: data });
}

export async function DELETE(_req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: t.loginRequired.th }, { status: 401 });

  // `on delete set null` on garments.fit_ruleset_id means affected garments
  // silently revert to their built-in fit_profile. No orphans, no broken evals.
  const { error } = await supabase
    .from('fit_rulesets')
    .delete()
    .eq('id', params.id)
    .eq('retailer_id', user.id);
  if (error) {
    console.error('fit_rulesets delete failed:', error.message);
    return NextResponse.json({ error: t.saveFailed.th }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
