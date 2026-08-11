import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { FitRulesetSchema, RulesetNameSchema, firstIssueMessage } from '@/lib/fit/rule-schema';

export async function GET() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('fit_rulesets')
    .select('id, name, rule, created_at')
    .eq('retailer_id', user.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ rulesets: data });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });

  const name = RulesetNameSchema.safeParse(body.name);
  if (!name.success) return NextResponse.json({ error: 'ชื่อกฎไม่ถูกต้อง' }, { status: 400 });

  const rule = FitRulesetSchema.safeParse(body.rule);
  if (!rule.success) {
    return NextResponse.json({ error: firstIssueMessage(rule.error) }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('fit_rulesets')
    .insert({ retailer_id: user.id, name: name.data, rule: rule.data })
    .select('id, name, rule, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ruleset: data });
}
