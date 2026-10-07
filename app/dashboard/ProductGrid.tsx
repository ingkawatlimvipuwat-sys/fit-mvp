'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import type { ProductSummary } from '@/lib/catalogue/summary';

export default function ProductGrid({
  products, shopSlug,
}: { products: ProductSummary[]; shopSlug: string | null }) {
  const [lang] = useLanguage();

  if (products.length === 0) {
    return <p className="text-gray-600">{t.noGarments[lang]}</p>;
  }

  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {products.map(p => (
        <li key={p.id} className="overflow-hidden rounded border bg-white">
          <Link href={`/dashboard/product/${p.id}`} className="block">
            <div className="aspect-square bg-gray-100">
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
          {shopSlug && (
            <div className="border-t px-3 py-2">
              <Link
                href={`/shop/${shopSlug}/p/${p.id}`}
                target="_blank"
                rel="noopener"
                className="text-xs text-blue-700 underline"
              >
                {t.previewShop[lang]}
              </Link>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
