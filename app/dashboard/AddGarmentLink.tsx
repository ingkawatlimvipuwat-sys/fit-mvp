'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function AddGarmentLink() {
  const [lang] = useLanguage();
  return (
    <Link href="/dashboard/garment/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
      {t.addGarment[lang]}
    </Link>
  );
}
