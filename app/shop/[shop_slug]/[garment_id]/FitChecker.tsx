'use client';
import { useEffect, useRef, useState } from 'react';
import { t } from '@/lib/i18n/strings';
import { getOrCreateCustomerToken } from '@/lib/customer-token';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { fillFromSize, estimateFromPartial } from '@/lib/fit/sizeEstimate';
import type { BodyProfile } from '@/lib/config/sizeChart';
import type { DimensionKey } from '@/lib/config/dimensions';
import { keepSharedValues } from '@/lib/catalogue/keep-shared';
import { summariseFit } from '@/lib/fit/summary';
import { easeBar } from '@/lib/fit/ease-bar';
import type { EaseRule } from '@/lib/fit/rules';
import { displaySizeLabel } from '@/lib/garment/size-label';
import Button from '@/app/components/ui/Button';
import Card from '@/app/components/ui/Card';
import Chip from '@/app/components/ui/Chip';
import Field from '@/app/components/ui/Field';
import VerdictChip, { VERDICT_CHIP, VERDICT_TEXT } from '@/app/components/ui/VerdictChip';

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
  garmentId, dimensions, sizeLabel = null,
}: {
  /** Null while a product page has no version picked yet; the check is then disabled. */
  garmentId: string | null; dimensions: DimInfo[];
  /** Stored size code of the picked version (e.g. 'M'); shown next to "Overall" in the result. */
  sizeLabel?: string | null;
}) {
  const [lang] = useLanguage();
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<FitResult | null>(null);
  // The rule behind each scored measurement; absent from older responses.
  const [rules, setRules] = useState<Record<string, EaseRule | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [profile, setProfile] = useState<BodyProfile>('women');
  const [sizeNote, setSizeNote] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

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

  // The shopper switched to another version of the product: the old verdict no
  // longer applies, and typed numbers survive only for dimensions the new
  // garment also asks for (spec 6). Skipped on first render.
  const lastGarmentId = useRef(garmentId);
  const dimensionKeys = dimensions.map(d => d.key).join(',');
  useEffect(() => {
    if (lastGarmentId.current === garmentId) return;
    lastGarmentId.current = garmentId;
    setResult(null);
    setError(null);
    setValues(v => keepSharedValues(v, dimensionKeys ? dimensionKeys.split(',') : []));
  }, [garmentId, dimensionKeys]);

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [result]);

  function editMeasurements() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    formRef.current?.querySelector('input')?.focus({ preventScroll: true });
  }

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
    if (garmentId === null) return;
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
      if (res.status === 429) setError(t.fitTooManyChecks[lang]);
      else if (!res.ok) setError(t.fitError[lang]);
      else {
        const j = await res.json();
        setRules(j.rules ?? {});
        setResult(j.result);
      }
    } catch {
      setError(t.networkError[lang]);
    } finally {
      setLoading(false);
    }
  }

  const summary = result ? summariseFit(result, dimensions.map(d => d.key)) : null;
  const sizeText = displaySizeLabel(sizeLabel, lang);
  const dimLabel = (key: string) => {
    const d = dimensions.find(x => x.key === key);
    return d ? (lang === 'th' ? d.labelTh : d.labelEn) : key;
  };

  return (
    <section className="mt-6 space-y-4">
      <form ref={formRef} className="space-y-4" onSubmit={onSubmit}>
        <h2 className="text-lg font-semibold">{t.yourMeasurements[lang]}</h2>
        <Card className="space-y-3 !rounded-[14px] !p-3.5">
          <div>
            <p className="font-semibold text-ink">{t.sizeHelperTitle[lang]}</p>
            <p className="text-[13px] text-muted">{t.sizeHelperIntro[lang]}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-[10px] border border-control">
              {(['women', 'men'] as const).map(p => (
                <button
                  key={p} type="button" onClick={() => setProfile(p)} aria-pressed={profile === p}
                  className={`h-11 px-3.5 text-base first:border-0 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-control ${
                    profile === p ? 'bg-accent-tint font-semibold text-accent-dark' : 'bg-surface text-ink'
                  }`}
                >
                  {p === 'women' ? t.profileWomen[lang] : t.profileMen[lang]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1.5">
              {(['S', 'M', 'L', 'XL'] as const).map(s => (
                <Chip key={s} className="!px-0 w-11" onClick={() => applySize(s)} aria-pressed={undefined}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          {sizeNote && <p className="text-xs text-muted">{sizeNote}</p>}
        </Card>
        {prefilled && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-accent-tint px-3 py-2">
            <span className="text-sm text-ink">{t.prefilledNotice[lang]}</span>
            <Button
              variant="ghost"
              onClick={() => { setValues({}); setPrefilled(false); }}
              className="shrink-0 !px-1 text-sm font-semibold"
            >
              {t.clearMeasurements[lang]}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-3 gap-y-4">
          {dimensions.map(d => (
            <Field
              key={d.key}
              label={lang === 'th' ? d.labelTh : d.labelEn}
              hint={lang === 'th' ? d.hintTh : d.hintEn}
              unit={t.unitCm[lang]}
              type="number" step="0.1" min="1" max="300" inputMode="decimal"
              value={values[d.key] ?? ''}
              onChange={e => {
                const val = e.target.value;
                setValues(v => ({ ...v, [d.key]: val }));
                setPrefilled(false);
                setSizeNote(null);
              }}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] text-muted">{t.blankNotScored[lang]}</p>
          <Button variant="ghost" onClick={estimateRest} className="shrink-0 text-sm font-semibold">
            {t.estimateRest[lang]}
          </Button>
        </div>
        <Button type="submit" fullWidth disabled={loading || garmentId === null}>
          {loading ? '…' : t.checkFit[lang]}
        </Button>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </form>

      {result && summary && (
        <div ref={resultRef} className="space-y-4">
          <Card className="space-y-2.5 !p-5">
            <p className="text-[13px] font-semibold text-muted">
              {t.overall[lang]}{sizeText ? ` · ${sizeText}` : ''}
            </p>
            <div className="flex items-center gap-3">
              <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-full ${VERDICT_CHIP[result.overall]}`}>
                <VerdictIcon verdict={result.overall} />
              </span>
              <h3 className={`text-[30px] font-bold leading-[1.15] ${VERDICT_TEXT[result.overall]}`}>
                {verdictLabel[result.overall]}
              </h3>
            </div>
            {summary.scored > 0 && (
              <div className="space-y-1 text-ink">
                <p>
                  {summary.good === summary.scored
                    ? t.fitSummaryAllGood[lang]
                    : t.fitSummaryCount[lang]
                        .replace('{good}', String(summary.good))
                        .replace('{scored}', String(summary.scored))}
                </p>
                {summary.issues.map(g => (
                  <p key={g.verdict} className="text-sm text-muted">
                    {verdictLabel[g.verdict]}: {g.keys.map(dimLabel).join(', ')}
                  </p>
                ))}
              </div>
            )}
          </Card>
          <Card className="!px-4 !py-1">
            <ul className="divide-y divide-line">
              {dimensions.map(d => {
                const r = result.dimensions[d.key];
                const v = r?.verdict ?? 'unknown';
                const rule = rules[d.key];
                // The engine's diff is customer minus garment; the bar is drawn in ease.
                const bar = rule && r && r.diff !== null ? easeBar(-r.diff, rule) : null;
                return (
                  <li key={d.key} className="space-y-1.5 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{lang === 'th' ? d.labelTh : d.labelEn}</span>
                      <VerdictChip verdict={v} label={verdictLabel[v]} />
                    </div>
                    {bar && (
                      <div aria-hidden="true" className="relative h-3">
                        <div className="absolute inset-x-0 top-[3px] flex h-1.5 overflow-hidden rounded-full">
                          <span className="bg-[#E8B49C]" style={{ width: bar.tight + '%' }} />
                          <span className="bg-[#F0D79A]" style={{ width: bar.snug + '%' }} />
                          <span className="bg-[#9CCBD0]" style={{ width: bar.good + '%' }} />
                          <span className="bg-[#D9DDE2]" style={{ width: bar.loose + '%' }} />
                        </div>
                        <span
                          className="absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full bg-ink ring-[3px] ring-surface"
                          style={{ left: bar.dot + '%' }}
                        />
                      </div>
                    )}
                    {r?.diff !== null && r?.diff !== undefined && (
                      <p className="text-[13px] text-muted">{diffPhrase(r.diff, lang)}</p>
                    )}
                  </li>
                );
              })}
            </ul>
            {Object.keys(rules).length > 0 && (
              <p className="border-t border-line py-3 text-xs text-muted">{t.easeBarCaption[lang]}</p>
            )}
          </Card>
          <Button variant="secondary" fullWidth onClick={editMeasurements}>
            {t.editMeasurements[lang]}
          </Button>
        </div>
      )}
    </section>
  );
}

function VerdictIcon({ verdict }: { verdict: Verdict }) {
  const common = {
    width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
  };
  if (verdict === 'good_fit') return <svg {...common}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
  if (verdict === 'snug') return <svg {...common}><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4" /></svg>;
  if (verdict === 'too_tight') return <svg {...common}><path d="M5 5l14 14M19 5L5 19" /></svg>;
  if (verdict === 'loose') return <svg {...common}><path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" /></svg>;
  return <svg {...common}><path d="M8 9.5a4 4 0 118 0c0 2.5-4 3-4 5.5M12 19h.01" /></svg>;
}
