import Link from 'next/link';
import { t } from '@/lib/i18n/strings';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <h1 className="text-3xl font-semibold">{t.notFoundTitle.th}</h1>
      <p className="mt-1 text-sm text-gray-400">{t.notFoundTitle.en}</p>

      <p className="mt-3 text-gray-600">{t.notFoundBody.th}</p>
      <p className="mt-1 text-sm text-gray-400">{t.notFoundBody.en}</p>

      <div className="mt-8">
        <Link href="/" className="rounded bg-gray-900 px-4 py-2 text-white">
          {t.backToHome.th}
        </Link>
      </div>
    </main>
  );
}
