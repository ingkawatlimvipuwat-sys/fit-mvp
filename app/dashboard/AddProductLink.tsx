'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function AddProductLink() {
  const [lang] = useLanguage();
  return (
    <Link href="/dashboard/product/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
      {t.newProduct[lang]}
    </Link>
  );
}
