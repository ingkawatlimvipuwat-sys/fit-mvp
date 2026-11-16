'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { sendJson } from '@/lib/catalogue/send-json';
import type { TagRow } from '@/lib/catalogue/tags';
import Notice from '@/app/components/ui/Notice';
import { CloseIcon } from '@/app/components/ui/icons';
import { inputClass } from '@/app/components/ui/classes';

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
      setMessage(r.error ?? t.saveFailed[lang]);
      router.refresh(); // a 'not found' usually means the page is stale
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const name = draft.trim();
    if (!name) return;
    if (await call(`/api/products/${productId}/tags`, 'POST', { name })) setDraft('');
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map(tag => (
          <span key={tag.id} className="inline-flex items-center rounded-full bg-[#EEF0F2] pl-3 text-sm text-[#2B313C]">
            <span className="break-all">{tag.name}</span>
            <button
              type="button"
              disabled={busy}
              aria-label={t.removeTag[lang].replace('{name}', tag.name)}
              onClick={() => call(`/api/products/${productId}/tags/${tag.id}`, 'DELETE')}
              className="inline-flex h-11 w-11 items-center justify-center text-muted hover:text-ink disabled:opacity-60"
            >
              <CloseIcon />
            </button>
          </span>
        ))}
        <form onSubmit={add}>
          <input
            list="shop-tag-suggestions"
            maxLength={30}
            value={draft}
            readOnly={busy}
            onChange={e => setDraft(e.target.value)}
            placeholder={t.addTagPlaceholder[lang]}
            aria-label={t.tags[lang]}
            className={`${inputClass} w-44`}
          />
          <datalist id="shop-tag-suggestions">
            {suggestions.map(s => <option key={s.id} value={s.name} />)}
          </datalist>
        </form>
      </div>
      {message && <Notice role="alert">{message}</Notice>}
    </div>
  );
}
