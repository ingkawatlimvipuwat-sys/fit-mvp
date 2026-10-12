'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';

/** Shown when the dashboard cannot load its data (page.tsx throws rather than show an empty catalogue). */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const [lang] = useLanguage();
  void error;

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-gray-700">{t.dashboardUnavailable[lang]}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded bg-gray-900 px-4 py-2 text-white"
      >
        {t.retry[lang]}
      </button>
    </div>
  );
}
