'use client';
import Link from 'next/link';
import LanguageToggle from '@/app/LanguageToggle';

export default function ShopHeader({ shopName, shopSlug }: { shopName: string; shopSlug: string }) {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <Link href={`/shop/${shopSlug}`} className="font-semibold hover:text-gray-600">
        {shopName}
      </Link>
      <LanguageToggle />
    </header>
  );
}
