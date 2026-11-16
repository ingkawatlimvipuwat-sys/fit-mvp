'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import Button from '@/app/components/ui/Button';

export default function ShopError({ error, reset }: { error: Error; reset: () => void }) {
  const [lang] = useLanguage();
  void error;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-ink">{t.shopUnavailable[lang]}</p>
      <Button onClick={() => reset()} className="mt-6">
        {t.retry[lang]}
      </Button>
    </main>
  );
}
