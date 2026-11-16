'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function DashboardNav() {
  const pathname = usePathname();
  const [lang] = useLanguage();

  const isGarmentsActive = pathname === '/dashboard' || pathname.startsWith('/dashboard/garment') || pathname.startsWith('/dashboard/product');
  const isFitRulesActive = pathname.startsWith('/dashboard/fit-rules');

  const tabClass = (active: boolean) =>
    `flex h-12 items-center px-3.5 text-base sm:h-[60px] ${
      active
        ? 'font-semibold text-ink shadow-[inset_0_-3px_0_theme(colors.accent.DEFAULT)]'
        : 'font-medium text-muted hover:text-ink'}`;

  return (
    <nav className="flex gap-1">
      <Link href="/dashboard" className={tabClass(isGarmentsActive)} aria-current={isGarmentsActive ? 'page' : undefined}>
        {t.navGarments[lang]}
      </Link>
      <Link href="/dashboard/fit-rules" className={tabClass(isFitRulesActive)} aria-current={isFitRulesActive ? 'page' : undefined}>
        {t.fitRulesNav[lang]}
      </Link>
    </nav>
  );
}
