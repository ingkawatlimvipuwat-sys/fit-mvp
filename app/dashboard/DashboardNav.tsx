'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/i18n/strings';

export default function DashboardNav() {
  const pathname = usePathname();

  const isGarmentsActive = pathname === '/dashboard' || pathname.startsWith('/dashboard/garment');
  const isFitRulesActive = pathname.startsWith('/dashboard/fit-rules');

  const tabClass = (active: boolean) =>
    active
      ? 'border-b-2 border-gray-900 px-1 py-3 text-sm font-medium text-gray-900'
      : 'border-b-2 border-transparent px-1 py-3 text-sm text-gray-500 hover:text-gray-900';

  return (
    <nav className="border-b bg-gray-50 px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className={tabClass(isGarmentsActive)}>
          {t.navGarments.th}
        </Link>
        <Link href="/dashboard/fit-rules" className={tabClass(isFitRulesActive)}>
          {t.fitRulesNav.th}
        </Link>
      </div>
    </nav>
  );
}
