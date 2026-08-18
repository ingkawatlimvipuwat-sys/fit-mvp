'use client';
import { useMemo } from 'react';
import { DIMENSIONS } from '@/lib/config/dimensions';
import { EaseRuleSchema } from '@/lib/fit/rule-schema';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { EaseRule, FitRuleset } from '@/lib/fit/rules';
import { t } from '@/lib/i18n/strings';
import { useLanguage, type Lang } from '@/lib/hooks/useLanguage';

// Matches VERDICT_COLOR in app/shop/[shop_slug]/[garment_id]/FitChecker.tsx
const ZONE_COLOR = {
  too_tight: 'bg-red-200', snug: 'bg-yellow-200',
  good_fit: 'bg-green-200', loose: 'bg-blue-200',
} as const;

const SCALE_MIN = -10, SCALE_MAX = 15;
const pct = (ease: number) =>
  Math.max(0, Math.min(100, ((ease - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100));

function NumberField({ label, value, onChange }: {
  label: string; value: number; onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm text-gray-700">{label}</span>
      <input
        type="number" step="0.5" inputMode="decimal" value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
      />
    </label>
  );
}

/** Horizontal ease scale, coloured into the four verdict zones. */
function Preview({ rule, lang }: { rule: EaseRule; lang: Lang }) {
  const zones = [
    { verdict: 'too_tight' as const, from: SCALE_MIN,        to: rule.tightBelow },
    { verdict: 'snug' as const,      from: rule.tightBelow,  to: rule.goodFrom },
    { verdict: 'good_fit' as const,  from: rule.goodFrom,    to: rule.goodTo },
    { verdict: 'loose' as const,     from: rule.goodTo,      to: SCALE_MAX },
  ];
  // Worked example, recomputed as the numbers change: a 96cm chest.
  const body = 96;
  const garmentAtGoodFit = body + (rule.goodFrom + rule.goodTo) / 2;

  return (
    <div className="space-y-2">
      <div className="flex h-6 w-full overflow-hidden rounded border">
        {zones.map(z => (
          <div
            key={z.verdict}
            className={ZONE_COLOR[z.verdict]}
            style={{ width: `${Math.max(0, pct(z.to) - pct(z.from))}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{SCALE_MIN} {t.unitCm[lang]}</span><span>0</span><span>+{SCALE_MAX} {t.unitCm[lang]}</span>
      </div>
      <p className="text-sm text-gray-700">
        {t.fitRuleExample[lang]
          .replace('{body}', String(body))
          .replace('{garment}', garmentAtGoodFit.toFixed(1))}{' '}
        {t.verdictGood[lang]}
      </p>
    </div>
  );
}

export default function FitRuleEditor({ value, onChange }: {
  value: FitRuleset;
  onChange: (next: FitRuleset) => void;
}) {
  const [lang] = useLanguage();
  const base = value.base ?? DEFAULT_RULE;
  const parsed = useMemo(() => EaseRuleSchema.safeParse(base), [base]);
  const error = parsed.success ? null : parsed.error.issues[0]?.message ?? null;

  const setBase = (patch: Partial<EaseRule>) =>
    onChange({ ...value, base: { ...base, ...patch } });

  const setDim = (key: string, rule: EaseRule | null) => {
    const next = { ...value.perDimension } as Record<string, EaseRule>;
    if (rule === null) delete next[key]; else next[key] = rule;
    onChange({ ...value, perDimension: next });
  };

  return (
    <div className="space-y-4">
      <NumberField label={t.fitRuleTightBelow[lang]} value={base.tightBelow} onChange={n => setBase({ tightBelow: n })} />
      <NumberField label={t.fitRuleGoodFrom[lang]}   value={base.goodFrom}   onChange={n => setBase({ goodFrom: n })} />
      <NumberField label={t.fitRuleGoodTo[lang]}     value={base.goodTo}     onChange={n => setBase({ goodTo: n })} />

      <div>
        <p className="mb-1 text-sm font-medium">{t.fitRulePreview[lang]}</p>
        {parsed.success ? <Preview rule={base} lang={lang} /> : <p className="text-sm text-red-600">{error}</p>}
      </div>

      <details className="rounded border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t.fitRulePerDimension[lang]}</summary>
        <div className="mt-3 space-y-4">
          {DIMENSIONS.map(d => {
            const dimRule = value.perDimension[d.key];
            return (
              <div key={d.key} className="rounded border p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox" checked={dimRule === undefined}
                    onChange={e => setDim(d.key, e.target.checked ? null : { ...base })}
                  />
                  <span>{lang === 'th' ? d.labelTh : d.labelEn} — {t.fitRuleSameAsAbove[lang]}</span>
                </label>
                {dimRule && (
                  <div className="mt-3 space-y-3">
                    <NumberField label={t.fitRuleTightBelow[lang]} value={dimRule.tightBelow} onChange={n => setDim(d.key, { ...dimRule, tightBelow: n })} />
                    <NumberField label={t.fitRuleGoodFrom[lang]}   value={dimRule.goodFrom}   onChange={n => setDim(d.key, { ...dimRule, goodFrom: n })} />
                    <NumberField label={t.fitRuleGoodTo[lang]}     value={dimRule.goodTo}     onChange={n => setDim(d.key, { ...dimRule, goodTo: n })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

/** Whether a ruleset is safe to save. Exported so parents can disable submit. */
export function isRulesetValid(rs: FitRuleset): boolean {
  if (rs.base && !EaseRuleSchema.safeParse(rs.base).success) return false;
  return Object.values(rs.perDimension).every(r => EaseRuleSchema.safeParse(r).success);
}
