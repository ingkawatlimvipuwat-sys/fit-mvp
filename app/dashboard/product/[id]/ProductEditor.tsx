'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { versionLabel, type PickerDef } from '@/lib/catalogue/picks';
import type { TagRow } from '@/lib/catalogue/tags';
import ProductTags from './ProductTags';
import PickerValueOrder from './PickerValueOrder';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import LinkButton from '@/app/components/ui/LinkButton';
import Notice from '@/app/components/ui/Notice';
import TextButton from '@/app/components/ui/TextButton';
import { WarningIcon, ChevronLeftIcon } from '@/app/components/ui/icons';
import { inputClass } from '@/app/components/ui/classes';

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
  /** Each picker's values in the owner's order (usedValuesByPicker). */
  valuesByPicker: Record<string, string[]>;
  versions: VersionRow[];
  tags: TagRow[];
  tagSuggestions: TagRow[];
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

export default function ProductEditor({ productId, name: initialName, shopSlug, pickers, valuesByPicker, versions, tags, tagSuggestions }: Props) {
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

  async function saveValueOrder(p: PickerDef, order: string[]): Promise<string | null> {
    const r = await send(`/api/products/${productId}/pickers/${p.id}`, 'PATCH', { value_order: order });
    if (!r.ok) return r.error ?? t.saveFailed[lang];
    router.refresh();
    return null;
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

  return (
    <div className="space-y-6">
      <Link href="/dashboard" className="inline-flex min-h-[44px] items-center gap-1 text-sm font-medium text-accent hover:text-accent-dark">
        <ChevronLeftIcon size={16} />
        {t.backToDashboard[lang]}
      </Link>

      <Card className="space-y-3">
        <input
          aria-label={t.productName[lang]}
          value={name} maxLength={120}
          onChange={e => setName(e.target.value)} onBlur={saveName}
          className="block h-12 w-full rounded-[10px] border border-field bg-surface px-3 text-xl font-semibold text-ink focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <ProductTags productId={productId} tags={tags} suggestions={tagSuggestions} />
        <div className="flex flex-wrap items-center gap-3">
          {shopSlug && (
            <Button
              variant="secondary"
              className="!h-11 !text-sm"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? '✓' : t.copyShopperLink[lang]}
            </Button>
          )}
          <TextButton tone="danger" disabled={busy} onClick={deleteProduct}>
            {t.deleteGarment[lang]}
          </TextButton>
        </div>
      </Card>

      {message && <Notice role="alert">{message}</Notice>}

      <Card className="space-y-3">
        <ul className="space-y-4">
          {pickers.map(p => (
            <li key={p.id} className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-3">
                <input
                  aria-label={t.pickerName[lang]}
                  defaultValue={p.name} maxLength={30}
                  onBlur={e => renamePicker(p, e.target.value)}
                  className={`${inputClass} grow sm:grow-0`}
                />
                <TextButton tone="danger" onClick={() => removePicker(p)}>
                  {t.removePicker[lang]}
                </TextButton>
              </div>
              <PickerValueOrder values={valuesByPicker[p.id] ?? []} onSave={order => saveValueOrder(p, order)} />
            </li>
          ))}
        </ul>

        {adding ? (
          <form onSubmit={addPicker} className="space-y-3 border-t border-line pt-3">
            <input
              required autoFocus aria-label={t.pickerName[lang]} placeholder={t.pickerName[lang]}
              value={newPicker} maxLength={30} onChange={e => setNewPicker(e.target.value)}
              className={`${inputClass} w-full sm:w-auto`}
            />
            {versions.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted">{t.pickerValuesPrompt[lang]}</p>
                {versions.map(v => (
                  <label key={v.id} className="flex items-center gap-3 text-sm text-ink">
                    <span className="w-24 shrink-0 truncate sm:w-32">{versionLabel(v.picks, pickers) || '—'}</span>
                    <input
                      value={backfill[v.id] ?? ''} maxLength={60}
                      onChange={e => setBackfill(b => ({ ...b, [v.id]: e.target.value }))}
                      className={`${inputClass} grow`}
                    />
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {t.save[lang]}
              </Button>
              <Button variant="ghost" onClick={() => { setAdding(false); setBackfill({}); }}>
                {t.cancel[lang]}
              </Button>
            </div>
          </form>
        ) : (
          <TextButton onClick={() => setAdding(true)} className="px-0">
            {t.addPicker[lang]}
          </TextButton>
        )}
      </Card>

      <section className="space-y-3">
        {versions.length === 0 && <p className="text-sm text-muted">{t.noVersions[lang]}</p>}
        <ul className="space-y-2">
          {versions.map(v => (
            <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[14px] border border-line bg-surface p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-[10px] bg-[#DDE1E6]">
                {v.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={v.photo_url} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 grow basis-40">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {v.colour && (
                    <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-control" style={{ backgroundColor: v.colour }} />
                  )}
                  {versionLabel(v.picks, pickers) || '—'}
                </div>
                <div className="truncate text-xs text-muted">
                  {v.measurements.map(m => `${lang === 'th' ? m.labelTh : m.labelEn} ${m.value}`).join(' · ')}
                </div>
                {v.reasons.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-verdict-tight-fg">
                    <WarningIcon size={14} />
                    {v.reasons.map(r => reasonText[r]).join(', ')}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center">
                <Link href={`/dashboard/garment/${v.id}/edit`} className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-accent underline-offset-2 hover:text-accent-dark hover:underline">{t.edit[lang]}</Link>
                <Link
                  href={`/dashboard/garment/new?product=${productId}&copy=${v.id}`}
                  className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-accent underline-offset-2 hover:text-accent-dark hover:underline"
                >
                  {t.duplicateVersion[lang]}
                </Link>
              </div>
            </li>
          ))}
        </ul>
        {versions.length > 0 && pickers.length === 0 ? (
          <Notice tone="warn">{t.addPickersFirst[lang]}</Notice>
        ) : (
          <LinkButton href={`/dashboard/garment/new?product=${productId}`}>
            {t.addVersion[lang]}
          </LinkButton>
        )}
      </section>
    </div>
  );
}
