'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import LanguageToggle from '@/app/LanguageToggle';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Field from '@/app/components/ui/Field';
import Notice from '@/app/components/ui/Notice';

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
    <main className="mx-auto max-w-md px-4 py-8 sm:py-16">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="inline-flex min-h-[44px] items-center text-sm font-medium text-accent hover:text-accent-dark">
          ← {t.backToHome[lang]}
        </Link>
        <LanguageToggle />
      </div>
      <Card className="mt-4 p-6">
      <h1 className="text-2xl font-semibold leading-tight">{t.signup[lang]}</h1>
      <form className="mt-8 space-y-4" onSubmit={onSubmit}>
        <SignupField name="shop_name" label={t.shopName[lang]} />
        <SignupField name="shop_slug" label={t.shopSlug[lang]} pattern="[a-z0-9-]{3,40}" />
        <SignupField name="email" label={t.email[lang]} type="email" />
        <SignupField name="password" label={t.password[lang]} type="password" minLength={8} />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" fullWidth disabled={loading}>
          {loading ? '…' : t.signupSubmit[lang]}
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {t.haveAccount[lang]}{' '}
        <Link href="/login" className="inline-flex min-h-[44px] items-center font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
          {t.login[lang]}
        </Link>
      </p>
      </Card>
    </main>
  );
}

function SignupField(props: {
  name: string; label: string; type?: string; pattern?: string; minLength?: number;
}) {
  return (
    <Field
      required
      name={props.name}
      label={props.label}
      type={props.type ?? 'text'}
      pattern={props.pattern}
      minLength={props.minLength}
    />
  );
}
