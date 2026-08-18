import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import LogoutButton from './LogoutButton';
import DashboardNav from './DashboardNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?reason=auth');

  // TODO: an orphaned retailer row (auth user exists but has no matching
  // `retailers` row — e.g. signup crashed after auth.signUp but before the
  // retailers insert) shows up here as retailer === null. This is
  // recoverable by manually inserting the missing row via Supabase Studio;
  // it does not require re-creating the auth user.
  const { data: retailer } = await supabase
    .from('retailers')
    .select('shop_name, shop_slug')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-6 py-3 text-white">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          {retailer?.shop_name ?? t.dashboardTitle.th}
          <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-normal">
            {t.dashboardBadge.th}
          </span>
        </Link>
        <nav className="flex items-center gap-4">
          <LogoutButton />
        </nav>
      </header>
      <DashboardNav />
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
