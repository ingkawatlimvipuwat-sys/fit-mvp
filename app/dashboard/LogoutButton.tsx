'use client';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [lang] = useLanguage();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="text-sm text-gray-300 hover:text-white"
    >
      {t.logout[lang]}
    </button>
  );
}
