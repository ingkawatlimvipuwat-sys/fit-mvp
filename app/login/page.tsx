'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LanguageToggle from '@/app/LanguageToggle';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lang] = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const loginRequired = searchParams.get('reason') === 'auth';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        // Supabase returns English messages (e.g. 'Invalid login credentials',
        // 'Failed to fetch') — never surface raw English strings to the UI.
        // The one case we distinguish is wrong email/password (matched
        // case-insensitively on the message, or by the 400 status Supabase
        // uses for it), which gets its own Thai copy so retailers can tell
        // "wrong password" from "something else broke". Every other error,
        // known or not, still falls back to the same generic Thai message.
        const isInvalidCredentials =
          error.status === 400 || /invalid login credentials/i.test(error.message);
        setError(isInvalidCredentials ? t.authInvalidCredentials[lang] : t.authError[lang]);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t.networkError[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-900">
          ← {t.backToHome[lang]}
        </Link>
        <LanguageToggle />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{t.login[lang]}</h1>
      {loginRequired && (
        <p className="mt-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {t.loginRequired[lang]}
        </p>
      )}
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm text-gray-700">{t.email[lang]}</span>
          <input required name="email" type="email" autoComplete="email" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">{t.password[lang]}</span>
          <input required name="password" type="password" autoComplete="current-password" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.loginSubmit[lang]}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        {t.noAccountYet[lang]}{' '}
        <Link href="/signup" className="underline text-gray-900">
          {t.signup[lang]}
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
