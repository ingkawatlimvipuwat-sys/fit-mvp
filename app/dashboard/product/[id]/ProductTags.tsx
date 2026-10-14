'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { sendJson } from '@/lib/catalogue/send-json';
import type { TagRow } from '@/lib/catalogue/tags';

// Raw English codes from the API are not for the owner's eyes (same rule as CatalogueBrowser.run()).
const RAW_CODES = new Set(['not found', 'invalid body', 'unauthorized']);

export default function ProductTags({ productId, tags, suggestions }: {
  productId: string; tags: TagRow[]; suggestions: TagRow[];
}) {
  const router = useRouter();
  const [lang] = useLanguage();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function call(url: string, method: 'POST' | 'DELETE', body?: unknown): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    const r = await sendJson(url, method, body);
    setBusy(false);
    if (!r.ok) {
      setMessage(r.error && !RAW_CODES.has(r.error) ? r.error : t.saveFailed[lang]);
      router.refresh(); // a 'not found' usually means the page is stale
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return;
    if (await call(`/api/products/${productId}/tags`, 'POST', { name })) setDraft('');
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map(tag => (
          <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border bg-gray-50 px-2 py-0.5 text-xs">
            <span className="break-all">{tag.name}</span>
            <button
              type="button"
              disabled={busy}
              aria-label={t.removeTag[lang].replace('{name}', tag.name)}
              onClick={() => call(`/api/products/${productId}/tags/${tag.id}`, 'DELETE')}
              className="text-gray-500 disabled:opacity-60"
            >
              ✕
            </button>
          </span>
        ))}
        <form onSubmit={add}>
          <input
            list="shop-tag-suggestions"
            maxLength={30}
            value={draft}
            disabled={busy}
            onChange={e => setDraft(e.target.value)}
            placeholder={t.addTagPlaceholder[lang]}
            aria-label={t.tags[lang]}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs"
          />
          <datalist id="shop-tag-suggestions">
            {suggestions.map(s => <option key={s.id} value={s.name} />)}
          </datalist>
        </form>
      </div>
      {message && <p role="alert" className="text-xs text-red-600">{message}</p>}
    </div>
  );
}
