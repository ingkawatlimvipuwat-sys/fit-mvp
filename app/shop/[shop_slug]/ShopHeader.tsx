'use client';
import Link from 'next/link';
import LanguageToggle from '@/app/LanguageToggle';

export default function ShopHeader({ shopName, shopSlug }: { shopName: string; shopSlug: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4">
      <Link href={`/shop/${shopSlug}`} className="flex min-h-[44px] items-center gap-1.5 font-medium text-ink hover:text-accent">
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        {shopName}
      </Link>
      <LanguageToggle />
    </header>
  );
}
