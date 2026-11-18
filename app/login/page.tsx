'use client';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LanguageToggle from '@/app/LanguageToggle';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Field from '@/app/components/ui/Field';
import Notice from '@/app/components/ui/Notice';

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
    <main className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent hover:text-accent-dark">
          ← {t.backToHome[lang]}
        </Link>
        <LanguageToggle />
      </div>
      <Card className="mt-4 p-6">
      <h1 className="text-2xl font-semibold leading-tight">{t.login[lang]}</h1>
      {loginRequired && (
        <Notice tone="warn" className="mt-4">
          {t.loginRequired[lang]}
        </Notice>
      )}
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <Field required name="email" type="email" autoComplete="email" label={t.email[lang]} />
        <Field required name="password" type="password" autoComplete="current-password" label={t.password[lang]} />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? '…' : t.loginSubmit[lang]}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {t.noAccountYet[lang]}{' '}
        <Link href="/signup" className="inline-flex min-h-[44px] items-center font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          {t.signup[lang]}
        </Link>
      </p>
      </Card>
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
