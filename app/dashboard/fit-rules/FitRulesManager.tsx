'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import FitRuleEditor, { isRulesetValid } from './FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import { t } from '@/lib/i18n/strings';
import { useLanguage, type Lang } from '@/lib/hooks/useLanguage';
import type { FitRulesetRow } from '@/lib/supabase/types';

const EMPTY: FitRuleset = { base: DEFAULT_RULE, perDimension: {} };

/**
 * One-line plain-language summary, e.g. "Fits when 1–5 cm roomier than the
 * body" (or the Thai equivalent).
 *
 * goodFrom/goodTo are ease values (garment minus body): positive means the
 * garment is roomier than the body, negative means narrower (a legitimate
 * setting for stretchy fabric). A plain numeric range reads wrong once
 * either bound goes negative — "-4–3" is unreadable (the range dash and
 * the minus sign look identical) and a literal reading of "roomier than
 * the body by minus four" is nonsense. So we branch on sign and phrase
 * negative bounds as "narrower than the body" instead of carrying the
 * minus sign into the range. Both languages' phrasing now live in
 * lib/i18n/strings.ts (ruleSummaryRoomy / ruleSummaryStraddle /
 * ruleSummaryNarrow); the values passed in are always positive magnitudes,
 * with the sign carried by which key is chosen, not by the number.
 */
function summarize(rs: FitRuleset, lang: Lang): string {
  const b = rs.base ?? DEFAULT_RULE;
  const { goodFrom, goodTo } = b;
  if (goodFrom >= 0 && goodTo >= 0) {
    return t.ruleSummaryRoomy[lang]
      .replace('{from}', String(goodFrom))
      .replace('{to}', String(goodTo));
  }
  if (goodFrom < 0 && goodTo >= 0) {
    return t.ruleSummaryStraddle[lang]
      .replace('{from}', String(Math.abs(goodFrom)))
      .replace('{to}', String(goodTo));
  }
  return t.ruleSummaryNarrow[lang]
    .replace('{from}', String(Math.abs(goodTo)))
    .replace('{to}', String(Math.abs(goodFrom)));
}

export default function FitRulesManager({ initial, counts, loadFailed = false }: {
  initial: FitRulesetRow[];
  counts: Record<string, number>;
  loadFailed?: boolean;
}) {
  const router = useRouter();
  const [lang] = useLanguage();
  const [editing, setEditing] = useState<{ id: string | null; name: string; rule: FitRuleset } | null>(null);
  // Snapshot of {name, rule} taken when editing opened, so cancel can tell
  // whether anything actually changed before warning about losing it.
  const [openedSnapshot, setOpenedSnapshot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startEditing(next: { id: string | null; name: string; rule: FitRuleset }) {
    setEditing(next);
    setOpenedSnapshot(JSON.stringify({ name: next.name, rule: next.rule }));
    setError(null);
  }

  function cancelEditing() {
    if (!editing) return;
    const current = JSON.stringify({ name: editing.name, rule: editing.rule });
    if (current !== openedSnapshot && !window.confirm(t.confirmDiscard[lang])) return;
    setEditing(null);
    setOpenedSnapshot(null);
    setError(null);
  }

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
        setError(typeof data.error === 'string' ? data.error : t.authError[lang]);
        return;
      }
      setEditing(null);
      router.refresh();
    } catch {
      setError(t.authError[lang]);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const n = counts[id] ?? 0;
    if (!confirm(`${t.fitRuleDeleteConfirm[lang]}\n${t.fitRuleGarmentCount[lang]}: ${n}`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fit-rulesets/${id}`, { method: 'DELETE' });
      if (!res.ok) { setError(t.authError[lang]); return; }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  let content: ReactNode;
  if (editing) {
    const valid = editing.name.trim() !== '' && isRulesetValid(editing.rule);
    content = (
      <div className="space-y-4 rounded border bg-white p-4">
        <label className="block">
          <span className="text-sm text-gray-700">{t.fitRuleName[lang]}</span>
          <input
            value={editing.name} placeholder={t.fitRuleNamePlaceholder[lang]} maxLength={60}
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
            {busy ? '…' : t.save[lang]}
          </button>
          <button onClick={cancelEditing} className="rounded border px-4 py-2">
            {t.cancel[lang]}
          </button>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="space-y-4">
        <button
          onClick={() => startEditing({ id: null, name: '', rule: EMPTY })}
          className="rounded bg-gray-900 px-4 py-2 text-white"
        >
          {t.fitRuleNew[lang]}
        </button>

        {!loadFailed && initial.length === 0 && <p className="text-sm text-gray-600">{t.fitRuleNone[lang]}</p>}

        <ul className="space-y-2">
          {initial.map(r => (
            <li key={r.id} className="flex items-center justify-between rounded border bg-white p-3">
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-sm text-gray-600">{summarize(r.rule, lang)}</p>
                <p className="text-xs text-gray-500">{t.fitRuleGarmentCount[lang]}: {counts[r.id] ?? 0}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEditing({ id: r.id, name: r.name, rule: r.rule })}
                  className="rounded border px-3 py-1 text-sm"
                >
                  {t.edit[lang]}
                </button>
                <button
                  onClick={() => remove(r.id)} disabled={busy}
                  className="rounded border border-red-300 px-3 py-1 text-sm text-red-700 disabled:opacity-60"
                >
                  {t.delete[lang]}
                </button>
              </div>
            </li>
          ))}
        </ul>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{t.fitRules[lang]}</h1>
      {loadFailed && <p className="text-sm text-red-600">{t.fitRulesLoadFailed[lang]}</p>}
      {content}
    </div>
  );
}
