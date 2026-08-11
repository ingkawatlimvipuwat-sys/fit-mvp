'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FitRuleEditor, { isRulesetValid } from './FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import { t } from '@/lib/i18n/strings';
import type { FitRulesetRow } from '@/lib/supabase/types';

const EMPTY: FitRuleset = { base: DEFAULT_RULE, perDimension: {} };

/** One-line plain-language summary, e.g. "พอดีเมื่อกว้างกว่าตัว 1–5 ซม." */
function summarize(rs: FitRuleset): string {
  const b = rs.base ?? DEFAULT_RULE;
  return `พอดีเมื่อกว้างกว่าตัว ${b.goodFrom}–${b.goodTo} ซม.`;
}

export default function FitRulesManager({ initial, counts }: {
  initial: FitRulesetRow[];
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{ id: string | null; name: string; rule: FitRuleset } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!editing) return;
    setError(null); setBusy(true);
    try {
      const isNew = editing.id === null;
      const res = await fetch(isNew ? '/api/fit-rulesets' : `/api/fit-rulesets/${editing.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editing.name, rule: editing.rule }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError.th);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError(t.authError.th);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const n = counts[id] ?? 0;
    if (!confirm(`${t.fitRuleDeleteConfirm.th}\n${t.fitRuleGarmentCount.th}: ${n}`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fit-rulesets/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError(t.authError.th); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    const valid = editing.name.trim() !== '' && isRulesetValid(editing.rule);
    return (
      <div className="space-y-4 rounded border bg-white p-4">
        <label className="block">
          <span className="text-sm text-gray-700">{t.fitRuleName.th}</span>
          <input
            value={editing.name} placeholder={t.fitRuleNamePlaceholder.th} maxLength={60}
            onChange={e => setEditing({ ...editing, name: e.target.value })}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>

        <FitRuleEditor value={editing.rule} onChange={rule => setEditing({ ...editing, rule })} />

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={save} disabled={!valid || busy}
            className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? '…' : t.save.th}
          </button>
          <button onClick={() => { setEditing(null); setError(null); }} className="rounded border px-4 py-2">
            {t.cancel.th}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setEditing({ id: null, name: '', rule: EMPTY })}
        className="rounded bg-gray-900 px-4 py-2 text-white"
      >
        {t.fitRuleNew.th}
      </button>

      {initial.length === 0 && <p className="text-sm text-gray-600">{t.fitRuleNone.th}</p>}

      <ul className="space-y-2">
        {initial.map(r => (
          <li key={r.id} className="flex items-center justify-between rounded border bg-white p-3">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-sm text-gray-600">{summarize(r.rule)}</p>
              <p className="text-xs text-gray-500">{t.fitRuleGarmentCount.th}: {counts[r.id] ?? 0}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing({ id: r.id, name: r.name, rule: r.rule })}
                className="rounded border px-3 py-1 text-sm"
              >
                {t.edit.th}
              </button>
              <button
                onClick={() => remove(r.id)} disabled={busy}
                className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-60"
              >
                {t.delete.th}
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
