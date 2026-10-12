'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import type { ProductSummary } from '@/lib/catalogue/summary';
import ActionsMenu from './ActionsMenu';

export default function ProductGrid({
  products, shopSlug, emptyText, onMove,
}: {
  products: ProductSummary[]; shopSlug: string | null; emptyText: string; onMove: (p: ProductSummary) => void;
}) {
  const [lang] = useLanguage();

  if (products.length === 0) {
    return <p className="text-gray-600">{emptyText}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
      {products.map(p => (
        // No overflow-hidden on the <li>: it would clip the ⋯ dropdown. The photo box clips instead.
        <li key={p.id} className="rounded border bg-white">
          <Link href={`/dashboard/product/${p.id}`} className="block">
            <div className="aspect-square overflow-hidden rounded-t bg-gray-100">
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photo_url} alt={p.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-3">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">
                {t.versionsCount[lang].replace('{n}', String(p.versionCount))}
              </div>
              {p.needsAttention && (
                <div className="mt-1 text-xs text-amber-700">⚠ {t.needsAttention[lang]}</div>
              )}
            </div>
          </Link>
          <div className="flex items-center justify-between border-t px-3 py-2">
            {shopSlug ? (
              <Link
                href={`/shop/${shopSlug}/p/${p.id}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-blue-700 underline"
              >
                {t.previewShop[lang]}
              </Link>
            ) : <span />}
            <ActionsMenu
              trigger="⋯"
              ariaLabel={t.moreActions[lang]}
              items={[{ text: t.moveTo[lang], onSelect: () => onMove(p) }]}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
