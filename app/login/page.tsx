'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      // Supabase returns English 'Invalid login credentials' for the common case
      // (wrong email/password). Map to a Thai-friendly message for consistency
      // with the signup page's friendly error handling.
      const msg = error.message === 'Invalid login credentials' ? t.authError.th : error.message;
      setError(msg);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">{t.login.th}</h1>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm text-gray-700">{t.email.th}</span>
          <input required name="email" type="email" autoComplete="email" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        <label className="block">
          <span className="text-sm text-gray-700">{t.password.th}</span>
          <input required name="password" type="password" autoComplete="current-password" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.loginSubmit.th}
        </button>
      </form>
    </main>
  );
}
