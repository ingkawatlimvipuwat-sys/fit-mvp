'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function BackLink({ shopSlug }: { shopSlug: string }) {
  const [lang] = useLanguage();
  return (
    <Link href={`/shop/${shopSlug}`} className="inline-block text-sm text-gray-600 hover:text-gray-900">
      ← {t.backToShop[lang]}
    </Link>
  );
}
