'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { versionLabel, type PickerDef } from '@/lib/catalogue/picks';

export interface VersionRow {
  id: string;
  picks: Record<string, string>;
  photo_url: string | null;
  colour: string | null;
  measurements: { labelTh: string; labelEn: string; value: number }[];
  reasons: ('missing_measurement' | 'missing_pick')[];
}

type Props = {
  productId: string;
  name: string;
  shopSlug: string | null;
  pickers: PickerDef[];
  versions: VersionRow[];
};

async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: typeof data.error === 'string' ? data.error : undefined };
  } catch {
    return { ok: false };
  }
}

export default function ProductEditor({ productId, name: initialName, shopSlug, pickers, versions }: Props) {
  const router = useRouter();
  const [lang] = useLanguage();
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState(shopSlug ? `/shop/${shopSlug}/p/${productId}` : '');
  const [adding, setAdding] = useState(false);
  const [newPicker, setNewPicker] = useState('');
  const [backfill, setBackfill] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (shopSlug) setLink(`${window.location.origin}/shop/${shopSlug}/p/${productId}`);
  }, [shopSlug, productId]);

  const fail = (error?: string) => setMessage(error ?? t.saveFailed[lang]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === initialName) { setName(trimmed || initialName); return; }
    setMessage(null);
    const r = await send(`/api/products/${productId}`, 'PATCH', { name: trimmed });
    if (!r.ok) return fail(r.error);
    router.refresh();
  }

  async function deleteProduct() {
    if (!window.confirm(t.confirmDeleteProduct[lang])) return;
    setBusy(true);
    const r = await send(`/api/products/${productId}`, 'DELETE');
    setBusy(false);
    if (!r.ok) return fail(r.error);
    router.push('/dashboard');
    router.refresh();
  }

  async function renamePicker(p: PickerDef, value: string) {
    const trimmed = value.trim();
    if (!trimmed || trimmed === p.name) return;
    setMessage(null);
    const r = await send(`/api/products/${productId}/pickers/${p.id}`, 'PATCH', { name: trimmed });
    if (!r.ok) return fail(r.error);
    router.refresh();
  }

  async function removePicker(p: PickerDef) {
    setMessage(null);
    const r = await send(`/api/products/${productId}/pickers/${p.id}`, 'DELETE');
    if (!r.ok) return fail(r.error);
    router.refresh();
  }

  async function addPicker(e: React.FormEvent) {
    e.preventDefault();
    if (!newPicker.trim()) return;
    setMessage(null);
    setBusy(true);
    const r = await send(`/api/products/${productId}/pickers`, 'POST', { name: newPicker, values: backfill });
    setBusy(false);
    if (!r.ok) return fail(r.error);
    setAdding(false);
    setNewPicker('');
    setBackfill({});
    router.refresh();
  }

  const reasonText = {
    missing_measurement: t.attentionMissingMeasurement[lang],
    missing_pick: t.attentionMissingPick[lang],
  } as const;
  const inputClass = 'rounded border border-gray-300 px-2 py-1 text-sm';

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="text-sm text-gray-600 underline">{t.backToDashboard[lang]}</Link>

      <div className="space-y-3">
        <input
          aria-label={t.productName[lang]}
          value={name} maxLength={120}
          onChange={e => setName(e.target.value)} onBlur={saveName}
          className="block w-full rounded border border-transparent px-2 py-1 text-xl font-semibold hover:border-gray-300"
        />
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {shopSlug && (
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="rounded border px-3 py-1"
            >
              {copied ? '✓' : t.copyShopperLink[lang]}
            </button>
          )}
          <button type="button" disabled={busy} onClick={deleteProduct} className="text-red-600 disabled:opacity-60">
            {t.deleteGarment[lang]}
          </button>
        </div>
      </div>

      {message && <p className="text-sm text-red-600" role="alert">{message}</p>}

      <section className="space-y-2 rounded border bg-white p-4">
        <ul className="space-y-2">
          {pickers.map(p => (
            <li key={p.id} className="flex items-center gap-3">
              <input
                aria-label={t.pickerName[lang]}
                defaultValue={p.name} maxLength={30}
                onBlur={e => renamePicker(p, e.target.value)}
                className={inputClass}
              />
              <button type="button" onClick={() => removePicker(p)} className="text-xs text-red-600">
                {t.removePicker[lang]}
              </button>
            </li>
          ))}
        </ul>

        {adding ? (
          <form onSubmit={addPicker} className="space-y-3 border-t pt-3">
            <input
              required autoFocus aria-label={t.pickerName[lang]} placeholder={t.pickerName[lang]}
              value={newPicker} maxLength={30} onChange={e => setNewPicker(e.target.value)}
              className={inputClass}
            />
            {versions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-600">{t.pickerValuesPrompt[lang]}</p>
                {versions.map(v => (
                  <label key={v.id} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 truncate">{versionLabel(v.picks, pickers) || '—'}</span>
                    <input
                      value={backfill[v.id] ?? ''} maxLength={60}
                      onChange={e => setBackfill(b => ({ ...b, [v.id]: e.target.value }))}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button type="submit" disabled={busy} className="rounded bg-gray-900 px-3 py-1 text-sm text-white disabled:opacity-60">
                {t.save[lang]}
              </button>
              <button type="button" onClick={() => { setAdding(false); setBackfill({}); }} className="text-sm text-gray-600 underline">
                {t.cancel[lang]}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="text-sm text-blue-700 underline">
            {t.addPicker[lang]}
          </button>
        )}
      </section>

      <section className="space-y-3">
        {versions.length === 0 && <p className="text-sm text-gray-600">{t.noVersions[lang]}</p>}
        <ul className="space-y-2">
          {versions.map(v => (
            <li key={v.id} className="flex items-center gap-3 rounded border bg-white p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-gray-100">
                {v.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.photo_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 grow">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {v.colour && (
                    <span className="inline-block h-3 w-3 rounded-full border" style={{ backgroundColor: v.colour }} />
                  )}
                  {versionLabel(v.picks, pickers) || '—'}
                </div>
                <div className="truncate text-xs text-gray-500">
                  {v.measurements.map(m => `${lang === 'th' ? m.labelTh : m.labelEn} ${m.value}`).join(' · ')}
                </div>
                {v.reasons.length > 0 && (
                  <div className="text-xs text-amber-700">⚠ {v.reasons.map(r => reasonText[r]).join(', ')}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <Link href={`/dashboard/garment/${v.id}/edit`} className="text-blue-700 underline">{t.edit[lang]}</Link>
                <Link
                  href={`/dashboard/garment/new?product=${productId}&copy=${v.id}`}
                  className="text-blue-700 underline"
                >
                  {t.duplicateVersion[lang]}
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {versions.length > 0 && pickers.length === 0 ? (
          <p className="text-sm text-amber-700">{t.addPickersFirst[lang]}</p>
        ) : (
          <Link
            href={`/dashboard/garment/new?product=${productId}`}
            className="inline-block rounded bg-gray-900 px-4 py-2 text-sm text-white"
          >
            {t.addVersion[lang]}
          </Link>
        )}
      </section>
    </div>
  );
}
