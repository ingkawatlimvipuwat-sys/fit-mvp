'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import Button from '../components/ui/Button';

/** Shown when the dashboard cannot load its data (page.tsx throws rather than show an empty catalogue). */
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  const [lang] = useLanguage();
  void error;

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-ink">{t.dashboardUnavailable[lang]}</p>
      <Button onClick={() => reset()} className="mt-6">
        {t.retry[lang]}
      </Button>
    </div>
  );
}
