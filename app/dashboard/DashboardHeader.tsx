'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LanguageToggle from '../LanguageToggle';
import LogoutButton from './LogoutButton';

export default function DashboardHeader({ shopName }: { shopName: string | null }) {
  const [lang] = useLanguage();

  return (
    <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-3 text-white">
      <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
        {shopName ?? t.dashboardTitle[lang]}
        <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-normal">
          {t.dashboardBadge[lang]}
        </span>
      </Link>
      <nav className="flex items-center gap-4">
        <LanguageToggle />
        <LogoutButton />
      </nav>
    </header>
  );
}
