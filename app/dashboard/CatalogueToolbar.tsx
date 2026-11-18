'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { isFiltered, type DashboardView, type SortKey } from '@/lib/catalogue/browse';
import type { TagRow } from '@/lib/catalogue/tags';
import { SearchIcon, TagIcon, WarningIcon } from './icons';

const SORT_TEXT = {
  newest: t.sortNewest, oldest: t.sortOldest, az: t.sortNameAZ, za: t.sortNameZA,
} as const;
const SORT_KEYS: SortKey[] = ['newest', 'oldest', 'az', 'za'];

/** Search, tag filter, sort, Needs attention and Clear. Every change goes up as a whole new view. */
export default function CatalogueToolbar({ view, tags, onChange, onManageTags }: {
  view: DashboardView; tags: TagRow[]; onChange: (next: DashboardView) => void;
  /** Opens the Manage tags panel; the button is hidden when absent. */
  onManageTags?: () => void;
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
  const control = 'h-11 rounded-[10px] border border-control bg-surface px-3 text-base text-ink hover:bg-page';

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-line bg-surface p-2.5">
      <label className="flex h-11 min-w-[8rem] grow basis-52 items-center gap-2 rounded-[10px] border border-field bg-surface px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30">
        <SearchIcon className="shrink-0 text-muted" />
        <input
          type="search"
          value={draft}
          maxLength={100}
          onChange={e => setDraft(e.target.value)}
          placeholder={t.searchProducts[lang]}
          aria-label={t.searchProducts[lang]}
          className="min-w-0 grow bg-transparent text-base text-ink outline-none"
        />
      </label>
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
        <span key={x.id} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-accent bg-accent-tint pl-3.5 pr-1 text-base font-semibold text-accent-dark">
          <span className="break-all">{x.name}</span>
          <button
            type="button"
            aria-label={t.removeTag[lang].replace('{name}', x.name)}
            onClick={() => onChange({ ...view, tagIds: view.tagIds.filter(id => id !== x.id) })}
            className="inline-flex h-11 w-9 items-center justify-center text-muted hover:text-ink"
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
        className={`inline-flex h-11 items-center gap-2 rounded-[10px] border px-3 text-base text-ink ${
          view.attention ? 'border-verdict-tight-fg bg-verdict-tight-bg font-semibold' : 'border-control bg-surface hover:bg-page'}`}
      >
        <WarningIcon size={18} className="shrink-0 text-verdict-tight-fg" />
        {t.needsAttention[lang]}
      </button>
      {onManageTags && (
        <button type="button" onClick={onManageTags} className={`${control} inline-flex items-center gap-2`}>
          <TagIcon />
          {t.manageTags[lang]}
        </button>
      )}
      {isFiltered(view) && (
        <button
          type="button"
          onClick={() => {
            // Clearing the draft also cancels the pending debounce (its effect cleanup runs on the draft change),
            // so text typed within the last 250 ms cannot come back as the search.
            sent.current = '';
            setDraft('');
            onChange({ ...view, q: '', tagIds: [], attention: false });
          }}
          className="inline-flex h-11 items-center px-2 text-base font-medium text-accent underline underline-offset-2 hover:text-accent-dark"
        >
          {t.clearFilters[lang]}
        </button>
      )}
    </div>
  );
}
