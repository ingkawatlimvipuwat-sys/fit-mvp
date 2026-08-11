'use client';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { dimensionsForCategory } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { t } from '@/lib/i18n/strings';
import type { Category } from '@/lib/supabase/types';
import FitRuleEditor, { isRulesetValid } from '@/app/dashboard/fit-rules/FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';

export default function NewGarmentPage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>('top');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dims = useMemo(() => dimensionsForCategory(category), [category]);
  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [useOverride, setUseOverride] = useState(false);
  const [override, setOverride] = useState<FitRuleset>({ base: DEFAULT_RULE, perDimension: {} });

  useEffect(() => {
    fetch('/api/fit-rulesets')
      .then(r => r.ok ? r.json() : { rulesets: [] })
      .then(d => setPresets(d.rulesets ?? []))
      .catch(() => setPresets([]));  // a failed load just means no presets offered
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const form = new FormData(e.currentTarget);
      // The grouped select carries one value; split it back into the two
      // mutually exclusive columns the API expects.
      const choice = String(form.get('fit_profile_or_ruleset') ?? 'profile:regular');
      form.delete('fit_profile_or_ruleset');
      if (useOverride) {
        if (!isRulesetValid(override)) { setError(t.authError.th); return; }
        form.set('fit_profile', 'regular');       // required column; the override wins at resolve time
        form.set('fit_rule_override', JSON.stringify(override));
      } else if (choice.startsWith('preset:')) {
        form.set('fit_profile', 'regular');       // fallback if the preset is later deleted
        form.set('fit_ruleset_id', choice.slice('preset:'.length));
      } else {
        form.set('fit_profile', choice.slice('profile:'.length));
      }
      const hasMeasurement = dims.some(d => {
        const v = form.get(d.key);
        return typeof v === 'string' && v.trim() !== '';
      });
      if (!hasMeasurement) {
        setError(t.garmentNeedsMeasurement.th);
        return;
      }
      const res = await fetch('/api/garments', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError.th);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      // Network failure (offline, timeout, DNS). Surface the generic error
      // so the user knows the form is recoverable.
      setError(t.authError.th);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{t.addGarment.th}</h1>

      <label className="block">
        <span className="text-sm text-gray-700">{t.garmentName.th}</span>
        <input required name="name" className="mt-1 block w-full rounded border border-gray-300 px-3 py-2" />
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.category.th}</span>
        <select
          name="category" required value={category}
          onChange={e => setCategory(e.target.value as Category)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="top">{t.catTop.th}</option>
          <option value="bottom">{t.catBottom.th}</option>
          <option value="dress">{t.catDress.th}</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.fitProfile.th}</span>
        <select
          name="fit_profile_or_ruleset" defaultValue="profile:regular"
          disabled={useOverride}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-60"
        >
          <optgroup label={t.fitRuleBuiltIn.th}>
            {FIT_PROFILES.map(p => (
              <option key={p.key} value={`profile:${p.key}`}>{p.labelTh}</option>
            ))}
          </optgroup>
          {presets.length > 0 && (
            <optgroup label={t.fitRuleShopRules.th}>
              {presets.map(p => <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
      </label>

      <div className="space-y-3 rounded border p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={useOverride} onChange={e => setUseOverride(e.target.checked)} />
          <span>{t.fitRuleOverride.th}</span>
        </label>
        {useOverride && <FitRuleEditor value={override} onChange={setOverride} />}
      </div>

      <label className="block">
        <span className="text-sm text-gray-700">{t.photo.th}</span>
        <input required name="photo" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
      </label>

      <fieldset className="space-y-3 rounded border p-4">
        <legend className="px-2 text-sm font-medium">{t.yourMeasurements.th}</legend>
        {dims.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">{d.labelTh} (cm)</span>
            <input
              name={d.key} type="number" step="0.1" min="1" max="300" inputMode="decimal"
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit" disabled={loading}
        className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
      >
        {loading ? '…' : t.save.th}
      </button>
    </form>
  );
}
