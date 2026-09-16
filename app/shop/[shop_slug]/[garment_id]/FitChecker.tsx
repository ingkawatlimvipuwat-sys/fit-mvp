'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { getOrCreateCustomerToken } from '@/lib/customer-token';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { fillFromSize, estimateFromPartial } from '@/lib/fit/sizeEstimate';
import type { BodyProfile } from '@/lib/config/sizeChart';
import type { DimensionKey } from '@/lib/config/dimensions';

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

// `diff` is customer minus garment (see lib/fit/engine.ts). A positive diff means the
// garment is smaller than the customer; a negative diff means the garment is roomier.
// This phrase is always a positive quantity so it reads the same direction as the
// ease convention used elsewhere in this product (garment minus customer, positive = roomy).
function diffPhrase(diff: number, lang: 'th' | 'en'): string {
  if (Math.abs(diff) < 0.05) return t.diffExact[lang];
  if (diff > 0) return t.diffSmaller[lang].replace('{n}', Math.abs(diff).toFixed(1));
  return t.diffRoomier[lang].replace('{n}', Math.abs(diff).toFixed(1));
}

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
  const [prefilled, setPrefilled] = useState(false);
  const [profile, setProfile] = useState<BodyProfile>('women');
  const [sizeNote, setSizeNote] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const garmentDims = dimensions.map(d => d.key) as DimensionKey[];

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
          if (Object.keys(pre).length > 0) {
            setValues(pre);
            setPrefilled(true);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  function applySize(size: 'S' | 'M' | 'L' | 'XL') {
    const filled = fillFromSize(profile, size, garmentDims);
    setValues(v => {
      const next = { ...v };
      for (const [k, num] of Object.entries(filled)) next[k] = String(num);
      return next;
    });
    setPrefilled(false);
    setError(null);
    setSizeNote(t.filledFromSize[lang].replace('{size}', size));
  }

  function estimateRest() {
    const known: Partial<Record<DimensionKey, number>> = {};
    for (const d of garmentDims) {
      const n = Number(values[d]);
      if (values[d] && Number.isFinite(n) && n > 0) known[d] = n;
    }
    const res = estimateFromPartial(profile, known, garmentDims);
    if (!res) {
      setSizeNote(t.needMeasurementToEstimate[lang]);
      return;
    }
    setValues(v => {
      const next = { ...v };
      for (const [k, num] of Object.entries(res.values)) next[k] = String(num);
      return next;
    });
    setPrefilled(false);
    setError(null);
    setSizeNote(t.estimatedAs[lang].replace('{size}', res.inferredSize));
  }

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
        <div className="space-y-2 rounded bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700">{t.sizeHelperTitle[lang]}</p>
          <p className="text-xs text-gray-500">{t.sizeHelperIntro[lang]}</p>
          <div className="flex gap-2">
            {(['women', 'men'] as const).map(p => (
              <button
                key={p} type="button" onClick={() => setProfile(p)}
                className={`rounded border px-3 py-1 text-sm ${
                  profile === p ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'
                }`}
              >
                {p === 'women' ? t.profileWomen[lang] : t.profileMen[lang]}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['S', 'M', 'L', 'XL'] as const).map(s => (
              <button
                key={s} type="button" onClick={() => applySize(s)}
                className="rounded border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700"
              >
                {s}
              </button>
            ))}
            <button
              type="button" onClick={estimateRest}
              className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-700"
            >
              {t.estimateRest[lang]}
            </button>
          </div>
          {sizeNote && <p className="text-xs text-gray-600">{sizeNote}</p>}
        </div>
        {prefilled && (
          <div className="flex items-center justify-between gap-3 rounded bg-gray-50 px-3 py-2">
            <span className="text-sm text-gray-500">{t.prefilledNotice[lang]}</span>
            <button
              type="button"
              onClick={() => { setValues({}); setPrefilled(false); }}
              className="shrink-0 text-sm font-medium text-gray-700 underline"
            >
              {t.clearMeasurements[lang]}
            </button>
          </div>
        )}
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
              onChange={e => {
                const val = e.target.value;
                setValues(v => ({ ...v, [d.key]: val }));
                setPrefilled(false);
                setSizeNote(null);
              }}
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
                <li key={d.key} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span>{lang === 'th' ? d.labelTh : d.labelEn}</span>
                  <span className="flex flex-col items-end gap-0.5 text-right">
                    <span className={`rounded px-2 py-0.5 text-xs ${VERDICT_COLOR[v]}`}>
                      {verdictLabel[v]}
                    </span>
                    {r?.diff !== null && r?.diff !== undefined && (
                      <span className="text-xs text-gray-500">{diffPhrase(r.diff, lang)}</span>
                    )}
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
