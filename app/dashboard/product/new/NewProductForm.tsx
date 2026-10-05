'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function NewProductForm() {
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
        body: JSON.stringify({ name }),
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
    <form className="space-y-5" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{t.newProduct[lang]}</h1>
      <label className="block">
        <span className="text-sm text-gray-700">{t.productName[lang]}</span>
        <input
          required maxLength={120} value={name} onChange={e => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="submit" disabled={loading}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? t.saving[lang] : t.save[lang]}
        </button>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">{t.cancel[lang]}</Link>
      </div>
    </form>
  );
}
