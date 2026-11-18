'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { DRAG_TYPE, type DragItem } from '@/lib/catalogue/folders';
import type { ProductSummary } from '@/lib/catalogue/summary';
import ActionsMenu from './ActionsMenu';
import { WarningIcon } from './icons';

export default function ProductGrid({
  products, shopSlug, emptyText, onMove, draggable, draggingId, onDragStart, onDragEnd,
}: {
  products: ProductSummary[]; shopSlug: string | null; emptyText: string; onMove: (p: ProductSummary) => void;
  /** Cards can be picked up (computer, nothing saving). */
  draggable?: boolean;
  draggingId?: string | null;
  onDragStart?: (item: DragItem) => void;
  onDragEnd?: () => void;
}) {
  const [lang] = useLanguage();

  if (products.length === 0) {
    return <p className="rounded-[14px] border border-line bg-surface p-6 text-center text-muted">{emptyText}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {products.map(p => (
        // No overflow-hidden on the <li>: it would clip the ⋯ dropdown. The photo box clips instead.
        <li
          key={p.id}
          className={`rounded-[14px] border border-line bg-surface ${draggingId === p.id ? 'opacity-50' : ''}`}
          draggable={draggable || undefined}
          onDragStart={draggable ? e => {
            e.dataTransfer.setData(DRAG_TYPE, p.id);
            e.dataTransfer.effectAllowed = 'move';
            const item: DragItem = { kind: 'product', id: p.id, name: p.name, folderId: p.folder_id };
            setTimeout(() => onDragStart?.(item), 0); // a DOM change inside dragstart cancels the drag in Chrome
          } : undefined}
          onDragEnd={draggable ? onDragEnd : undefined}
        >
          {/* draggable={false} on the link and picture: the whole card moves, not the link URL or the image. */}
          <Link href={`/dashboard/product/${p.id}`} className="block" draggable={false}>
            <div className="aspect-square overflow-hidden rounded-t-[13px] bg-[#DDE1E6]">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" draggable={false} />
              ) : null}
            </div>
            <div className="space-y-1.5 p-3">
              <div className="break-words font-semibold text-ink">{p.name}</div>
              <div className="text-sm text-muted">
                {t.versionsCount[lang].replace('{n}', String(p.versionCount))}
              </div>
              {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.slice(0, 3).map(tag => (
                    <span key={tag.id} className="break-all rounded-full bg-[#EEF0F2] px-2.5 py-0.5 text-xs text-[#2B313C]">
                      {tag.name}
                    </span>
                  ))}
                  {p.tags.length > 3 && <span className="text-xs text-muted">+{p.tags.length - 3}</span>}
                </div>
              )}
              {p.needsAttention && (
                <div className="flex items-center gap-1.5 text-sm font-semibold text-verdict-tight-fg">
                  <WarningIcon />
                  {t.needsAttention[lang]}
                </div>
              )}
            </div>
          </Link>
          <div className="flex items-center justify-between border-t border-line pl-3 pr-1">
            {shopSlug ? (
              <Link
                href={`/shop/${shopSlug}/p/${p.id}`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent underline-offset-2 hover:text-accent-dark hover:underline"
              >
                {t.previewShop[lang]}
              </Link>
            ) : <span />}
            <ActionsMenu
              ariaLabel={t.moreActions[lang]}
              items={[{ text: t.moveTo[lang], onSelect: () => onMove(p) }]}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
