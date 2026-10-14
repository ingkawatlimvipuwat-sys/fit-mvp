'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { isFiltered, type DashboardView, type SortKey } from '@/lib/catalogue/browse';
import type { TagRow } from '@/lib/catalogue/tags';

const SORT_TEXT = {
  newest: t.sortNewest, oldest: t.sortOldest, az: t.sortNameAZ, za: t.sortNameZA,
} as const;
const SORT_KEYS: SortKey[] = ['newest', 'oldest', 'az', 'za'];

/** Search, tag filter, sort, ⚠ Needs attention and Clear. Every change goes up as a whole new view. */
export default function CatalogueToolbar({ view, tags, onChange }: {
  view: DashboardView; tags: TagRow[]; onChange: (next: DashboardView) => void;
}) {
  const [lang] = useLanguage();
  const [draft, setDraft] = useState(view.q);
  const sent = useRef(view.q);
  // The debounce timer must see the view as it is when it fires, not when typing started.
  const latest = useRef({ view, onChange });
  latest.current = { view, onChange };

  // Push the typed search to the view 250 ms after typing stops.
  useEffect(() => {
    const h = setTimeout(() => {
      const { view: v, onChange: change } = latest.current;
      if (draft !== v.q) { sent.current = draft; change({ ...v, q: draft }); }
    }, 250);
    return () => clearTimeout(h);
  }, [draft]);

  // Resync from the address bar only when the change came from elsewhere (Back, Clear):
  // without the ref, a keystroke typed while the address bar updates would be overwritten.
  useEffect(() => {
    if (view.q !== sent.current) { sent.current = view.q; setDraft(view.q); }
  }, [view.q]);

  const selected = view.tagIds
    .map(id => tags.find(x => x.id === id))
    .filter((x): x is TagRow => x !== undefined);
  const unselected = tags.filter(x => !view.tagIds.includes(x.id));
  const control = 'rounded border border-gray-300 bg-white px-2 py-1 text-sm';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        value={draft}
        maxLength={100}
        onChange={e => setDraft(e.target.value)}
        placeholder={t.searchProducts[lang]}
        aria-label={t.searchProducts[lang]}
        className={`${control} min-w-[8rem] grow`}
      />
      {unselected.length > 0 && (
        <select
          value=""
          aria-label={t.filterByTag[lang]}
          onChange={e => { if (e.target.value) onChange({ ...view, tagIds: [...view.tagIds, e.target.value] }); }}
          className={control}
        >
          <option value="">{t.filterByTag[lang]}</option>
          {unselected.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      )}
      {selected.map(x => (
        <span key={x.id} className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2 py-0.5 text-xs">
          <span className="break-all">{x.name}</span>
          <button
            type="button"
            aria-label={t.removeTag[lang].replace('{name}', x.name)}
            onClick={() => onChange({ ...view, tagIds: view.tagIds.filter(id => id !== x.id) })}
            className="text-gray-500"
          >
            ✕
          </button>
        </span>
      ))}
      <select
        value={view.sort}
        aria-label={t.sortLabel[lang]}
        onChange={e => onChange({ ...view, sort: e.target.value as SortKey })}
        className={control}
      >
        {SORT_KEYS.map(k => <option key={k} value={k}>{SORT_TEXT[k][lang]}</option>)}
      </select>
      <button
        type="button"
        aria-pressed={view.attention}
        onClick={() => onChange({ ...view, attention: !view.attention })}
        className={`rounded border px-2 py-1 text-sm ${
          view.attention ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-gray-300 bg-white text-gray-700'}`}
      >
        ⚠ {t.needsAttention[lang]}
      </button>
      {isFiltered(view) && (
        <button
          type="button"
          onClick={() => onChange({ ...view, q: '', tagIds: [], attention: false })}
          className="text-sm text-gray-600 underline"
        >
          {t.clearFilters[lang]}
        </button>
      )}
    </div>
  );
}
