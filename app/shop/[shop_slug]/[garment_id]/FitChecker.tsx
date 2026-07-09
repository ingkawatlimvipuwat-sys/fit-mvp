'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { getOrCreateCustomerToken } from '@/lib/customer-token';
import { useLanguage } from '@/lib/hooks/useLanguage';

type DimInfo = {
  key: string;
  labelTh: string; hintTh: string;
  labelEn: string; hintEn: string;
};
type Verdict = 'too_tight' | 'snug' | 'good_fit' | 'loose' | 'unknown';

interface FitResult {
  overall: Verdict;
  dimensions: Record<string, { verdict: Verdict; customer: number | null; garment: number | null; diff: number | null }>;
}

const VERDICT_COLOR: Record<Verdict, string> = {
  too_tight: 'bg-red-100 text-red-800',
  snug: 'bg-yellow-100 text-yellow-800',
  good_fit: 'bg-green-100 text-green-800',
  loose: 'bg-blue-100 text-blue-800',
  unknown: 'bg-gray-100 text-gray-600',
};

export default function FitChecker({
  garmentId, dimensions,
}: {
  garmentId: string; dimensions: DimInfo[];
}) {
  const [lang] = useLanguage();
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<FitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const verdictLabel: Record<Verdict, string> = {
    too_tight: t.verdictTooTight[lang], snug: t.verdictSnug[lang],
    good_fit: t.verdictGood[lang], loose: t.verdictLoose[lang], unknown: t.verdictUnknown[lang],
  };

  // Pre-fill from the customer's last session.
  useEffect(() => {
    const token = getOrCreateCustomerToken();
    fetch(`/api/fit/last?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(j => {
        if (j.measurements && typeof j.measurements === 'object') {
          const pre: Record<string, string> = {};
          for (const [k, v] of Object.entries(j.measurements)) {
            if (typeof v === 'number') pre[k] = String(v);
          }
          setValues(pre);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(null);
    const measurements: Record<string, number> = {};
    for (const d of dimensions) {
      const v = values[d.key];
      if (v && v.trim() !== '') {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) measurements[d.key] = n;
      }
    }
    if (Object.keys(measurements).length === 0) {
      setError(t.needOneMeasurement[lang]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/fit/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          garment_id: garmentId,
          customer_token: getOrCreateCustomerToken(),
          customer_measurements: measurements,
        }),
      });
      const j = await res.json();
      if (res.ok) setResult(j.result);
      else setError(t.fitError[lang]);
    } catch {
      setError(t.networkError[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <form className="space-y-4 rounded border bg-white p-4" onSubmit={onSubmit}>
        <h2 className="text-lg font-medium">{t.yourMeasurements[lang]}</h2>
        {dimensions.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">
              {lang === 'th' ? d.labelTh : d.labelEn} (cm)
            </span>
            <span className="block text-xs text-gray-500">
              {lang === 'th' ? d.hintTh : d.hintEn}
            </span>
            <input
              type="number" step="0.1" min="1" max="300" inputMode="decimal"
              value={values[d.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [d.key]: e.target.value }))}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
        <button
          type="submit" disabled={loading}
          className="w-full rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? '…' : t.checkFit[lang]}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {result && (
        <div ref={resultRef} className="space-y-3 rounded border bg-white p-4">
          <div className={`inline-block rounded px-3 py-1 text-sm ${VERDICT_COLOR[result.overall]}`}>
            {t.overall[lang]}: {verdictLabel[result.overall]}
          </div>
          <ul className="divide-y">
            {dimensions.map(d => {
              const r = result.dimensions[d.key];
              const v = r?.verdict ?? 'unknown';
              return (
                <li key={d.key} className="flex items-center justify-between py-2 text-sm">
                  <span>{lang === 'th' ? d.labelTh : d.labelEn}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${VERDICT_COLOR[v]}`}>
                    {verdictLabel[v]}
                    {r?.diff !== null && r?.diff !== undefined ? ` (${r.diff > 0 ? '+' : ''}${r.diff.toFixed(1)}cm)` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
