import { createSupabaseServerClient } from '@/lib/supabase/server';
import FitRulesManager from './FitRulesManager';
import type { FitRulesetRow } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

export default async function FitRulesPage() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // middleware guards this route

  const { data: rulesets, error: rulesetsError } = await supabase
    .from('fit_rulesets')
    .select('id, name, rule, created_at, retailer_id')
    .eq('retailer_id', user.id)
    .order('created_at', { ascending: true });

  // Garment counts, so delete can state what reverts. Non-critical: only
  // drives delete-confirmation counts, so a silent failure here is acceptable.
  const { data: garments } = await supabase
    .from('garments')
    .select('fit_ruleset_id')
    .eq('retailer_id', user.id);

  const counts: Record<string, number> = {};
  for (const g of garments ?? []) {
    if (g.fit_ruleset_id) counts[g.fit_ruleset_id] = (counts[g.fit_ruleset_id] ?? 0) + 1;
  }

  const loadFailed = rulesetsError != null;

  return (
    <FitRulesManager
      initial={(rulesets ?? []) as FitRulesetRow[]}
      counts={counts}
      loadFailed={loadFailed}
    />
  );
}
