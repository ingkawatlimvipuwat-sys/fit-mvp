'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LanguageToggle from '@/app/LanguageToggle';

export default function SignupPage() {
  const router = useRouter();
  const [lang] = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries()) as Record<string, string>;
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError[lang]);
        return;
      }
      router.push('/dashboard');
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
      <h1 className="mt-4 text-2xl font-semibold">{t.signup[lang]}</h1>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <Field name="shop_name" label={t.shopName[lang]} />
        <Field name="shop_slug" label={t.shopSlug[lang]} pattern="[a-z0-9-]{3,40}" />
        <Field name="email" label={t.email[lang]} type="email" />
        <Field name="password" label={t.password[lang]} type="password" minLength={8} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.signupSubmit[lang]}
        </button>
      </form>
      <p className="mt-4 text-sm text-gray-600">
        {t.haveAccount[lang]}{' '}
        <Link href="/login" className="underline text-gray-900">
          {t.login[lang]}
        </Link>
      </p>
    </main>
  );
}

function Field(props: {
  name: string; label: string; type?: string; pattern?: string; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-700">{props.label}</span>
      <input
        required
        name={props.name}
        type={props.type ?? 'text'}
        pattern={props.pattern}
        minLength={props.minLength}
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}
