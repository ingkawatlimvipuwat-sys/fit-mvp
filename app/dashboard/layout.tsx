import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LanguageProvider } from '@/lib/hooks/useLanguage';
import DashboardHeader from './DashboardHeader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
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
    <LanguageProvider>
      <div className="min-h-screen bg-page text-ink">
        <DashboardHeader shopName={retailer?.shop_name ?? null} shopSlug={retailer?.shop_slug ?? null} />
        <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">{children}</main>
      </div>
    </LanguageProvider>
  );
}
