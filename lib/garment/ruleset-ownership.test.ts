import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkRulesetOwnership } from './ruleset-ownership';

const ME = '11111111-2222-4333-8444-555555555555';
const PRESET = '99999999-2222-4333-8444-555555555555';

/** Records the filters applied, and answers as the database would. */
function fakeClient(result: { data: unknown; error: unknown }) {
  const calls: { table?: string; filters: [string, unknown][] } = { filters: [] };
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => { calls.filters.push([col, val]); return builder; },
    maybeSingle: () => Promise.resolve(result),
  };
  const from = vi.fn((table: string) => { calls.table = table; return builder; });
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

describe('checkRulesetOwnership', () => {
  it('passes without a query when no preset is referenced', async () => {
    const { client, from } = fakeClient({ data: null, error: null });
    expect(await checkRulesetOwnership(client, ME, null)).toEqual({ ok: true });
    expect(from).not.toHaveBeenCalled();
  });

  it('passes when the caller owns the preset', async () => {
    const { client } = fakeClient({ data: { id: PRESET }, error: null });
    expect(await checkRulesetOwnership(client, ME, PRESET)).toEqual({ ok: true });
  });

  it("rejects another shop's preset with a 400", async () => {
    const { client } = fakeClient({ data: null, error: null });
    const r = await checkRulesetOwnership(client, ME, PRESET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(400);
  });

  it('scopes the lookup to the preset id AND the caller', async () => {
    const { client, calls } = fakeClient({ data: { id: PRESET }, error: null });
    await checkRulesetOwnership(client, ME, PRESET);
    expect(calls.table).toBe('fit_rulesets');
    expect(calls.filters).toContainEqual(['id', PRESET]);
    expect(calls.filters).toContainEqual(['retailer_id', ME]);
  });

  it('fails closed with a 500 when the lookup itself errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = fakeClient({ data: null, error: { message: 'boom' } });
    const r = await checkRulesetOwnership(client, ME, PRESET);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
    spy.mockRestore();
  });
});
