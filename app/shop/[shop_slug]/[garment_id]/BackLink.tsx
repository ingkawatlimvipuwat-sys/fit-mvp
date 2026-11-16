'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function BackLink({ shopSlug }: { shopSlug: string }) {
  const [lang] = useLanguage();
  return (
    <Link href={`/shop/${shopSlug}`} className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent hover:text-accent-dark">
      ← {t.backToShop[lang]}
    </Link>
  );
}
