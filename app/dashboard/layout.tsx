import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { t } from '@/lib/i18n/strings';
import LogoutButton from './LogoutButton';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: retailer } = await supabase
    .from('retailers')
    .select('shop_name, shop_slug')
    .eq('id', user.id)
    .single();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <Link href="/dashboard" className="font-semibold">
          {retailer?.shop_name ?? t.dashboardTitle.th}
        </Link>
        <LogoutButton />
      </header>
      <main className="mx-auto max-w-4xl p-6">{children}</main>
    </div>
  );
}
