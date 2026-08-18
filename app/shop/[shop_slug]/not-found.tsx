import Link from 'next/link';
import { t } from '@/lib/i18n/strings';

/**
 * The boundary for a bad shop slug — LINE truncates URLs and customers retype
 * them, so this is a routine path. A bad garment id under a VALID shop hits
 * the deeper [garment_id]/not-found.tsx instead, which is why this one talks
 * about the shop link rather than a missing item.
 */
export default function ShopNotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">{t.notFoundShopTitle.th}</h1>
      <p className="mt-1 text-sm text-gray-400">{t.notFoundShopTitle.en}</p>

      <p className="mt-3 text-gray-600">{t.notFoundShopBody.th}</p>
      <p className="mt-1 text-sm text-gray-400">{t.notFoundShopBody.en}</p>

      <div className="mt-8">
        <Link href="/" className="rounded bg-gray-900 px-4 py-2 text-white">
          {t.backToHome.th}
        </Link>
      </div>
    </main>
  );
}
