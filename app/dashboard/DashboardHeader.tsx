'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LanguageToggle from '../LanguageToggle';
import CopyPublicLink from './CopyPublicLink';
import DashboardNav from './DashboardNav';
import LogoutButton from './LogoutButton';

/** White header: shop name + badge, the Products / Shop rules tabs, then link, language and log out. */
export default function DashboardHeader({ shopName, shopSlug }: { shopName: string | null; shopSlug: string | null }) {
  const [lang] = useLanguage();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-0 px-4 sm:px-6">
        <Link href="/dashboard" className="flex min-h-[52px] min-w-0 items-center gap-2.5 text-[17px] font-semibold text-ink">
          <span className="min-w-0 truncate">{shopName ?? t.dashboardTitle[lang]}</span>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[#EEF0F2] px-2.5 py-0.5 text-xs font-semibold text-[#2B313C]">
            {t.dashboardBadge[lang]}
          </span>
        </Link>
        <div className="order-3 w-full sm:order-none sm:w-auto sm:grow">
          <DashboardNav />
        </div>
        <div className="order-2 flex items-center gap-2 py-2 sm:order-none">
          {shopSlug && <CopyPublicLink slug={shopSlug} />}
          <LanguageToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
