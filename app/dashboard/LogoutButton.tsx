'use client';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="text-sm text-gray-600 hover:text-gray-900"
    >
      {t.logout.th}
    </button>
  );
}
