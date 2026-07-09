'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';

export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  const [lang] = useLanguage();
  void error;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-gray-700">{t.shopUnavailable[lang]}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-white"
      >
        {t.retry[lang]}
      </button>
    </main>
  );
}
