'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Field from '@/app/components/ui/Field';
import Notice from '@/app/components/ui/Notice';

export default function NewProductForm({ folderId }: { folderId: string | null }) {
  const router = useRouter();
  const [lang] = useLanguage();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError(t.garmentNameRequired[lang]); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, folder_id: folderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(typeof data.error === 'string' ? data.error : t.saveFailed[lang]); return; }
      router.push(`/dashboard/product/${data.id}`);
      router.refresh();
    } catch {
      setError(t.networkError[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="mx-auto max-w-xl space-y-4" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold leading-snug">{t.newProduct[lang]}</h1>
      <Card className="space-y-4">
        <Field
          label={t.productName[lang]}
          required maxLength={120} value={name} onChange={e => setName(e.target.value)}
        />
        {error && <Notice>{error}</Notice>}
      </Card>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? t.saving[lang] : t.save[lang]}
        </Button>
        <Link
          href={folderId ? `/dashboard?folder=${folderId}` : '/dashboard'}
          className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-accent underline-offset-2 hover:text-accent-dark hover:underline"
        >
          {t.cancel[lang]}
        </Link>
      </div>
    </form>
  );
}
