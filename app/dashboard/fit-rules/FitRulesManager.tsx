'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import FitRuleEditor, { isRulesetValid } from './FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import { t } from '@/lib/i18n/strings';
import { useLanguage, type Lang } from '@/lib/hooks/useLanguage';
import type { FitRulesetRow } from '@/lib/supabase/types';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Field from '@/app/components/ui/Field';
import Notice from '@/app/components/ui/Notice';
import TextButton from '@/app/components/ui/TextButton';

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
      <Card className="space-y-4">
        <Field
          label={t.fitRuleName[lang]}
          value={editing.name} placeholder={t.fitRuleNamePlaceholder[lang]} maxLength={60}
          onChange={e => setEditing({ ...editing, name: e.target.value })}
        />

        <FitRuleEditor value={editing.rule} onChange={rule => setEditing({ ...editing, rule })} />

        {error && <Notice>{error}</Notice>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={!valid || busy}>
            {busy ? '…' : t.save[lang]}
          </Button>
          <Button variant="secondary" onClick={cancelEditing}>
            {t.cancel[lang]}
          </Button>
        </div>
      </Card>
    );
  } else {
    content = (
      <div className="space-y-4">
        <Button onClick={() => startEditing({ id: null, name: '', rule: EMPTY })}>
          {t.fitRuleNew[lang]}
        </Button>

        {!loadFailed && initial.length === 0 && <p className="text-sm text-muted">{t.fitRuleNone[lang]}</p>}

        <ul className="space-y-2">
          {initial.map(r => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-[14px] border border-line bg-surface p-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-ink">{r.name}</p>
                <p className="text-sm text-muted">{summarize(r.rule, lang)}</p>
                <p className="text-xs text-muted">{t.fitRuleGarmentCount[lang]}: {counts[r.id] ?? 0}</p>
              </div>
              <div className="flex items-center">
                <TextButton onClick={() => startEditing({ id: r.id, name: r.name, rule: r.rule })}>
                  {t.edit[lang]}
                </TextButton>
                <TextButton tone="danger" onClick={() => remove(r.id)} disabled={busy}>
                  {t.delete[lang]}
                </TextButton>
              </div>
            </li>
          ))}
        </ul>
        {error && <Notice>{error}</Notice>}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold leading-snug">{t.fitRules[lang]}</h1>
      {loadFailed && <Notice>{t.fitRulesLoadFailed[lang]}</Notice>}
      {content}
    </div>
  );
}
