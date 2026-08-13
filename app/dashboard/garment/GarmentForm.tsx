'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dimensionsForCategory, dimensionByKey } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { t } from '@/lib/i18n/strings';
import type { Category, MeasurementBag } from '@/lib/supabase/types';
import FitRuleEditor, { isRulesetValid } from '@/app/dashboard/fit-rules/FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import { activeMeasurements, strandedDimensions, buildGarmentFields } from '@/lib/garment/form-fields';

/** Everything edit mode needs to reproduce a garment's current state. */
export interface GarmentFormInitial {
  id: string;
  name: string;
  category: Category;
  photo_url: string;
  measurements: MeasurementBag;
  /** From ruleSelectionForGarment() — see lib/fit/rule-selection.ts. */
  useOverride: boolean;
  override: FitRuleset;
  ruleChoice: string;
  profileKey: string;
}

type GarmentFormProps =
  | { mode: 'create'; initial?: undefined }
  | { mode: 'edit'; initial: GarmentFormInitial };

export default function GarmentForm({ mode, initial }: GarmentFormProps) {
  const router = useRouter();
  const isEdit = mode === 'edit';
  const photoRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'top');
  const [ruleChoice, setRuleChoice] = useState(initial?.ruleChoice ?? 'profile:regular');
  const [useOverride, setUseOverride] = useState(initial?.useOverride ?? false);
  const [override, setOverride] = useState<FitRuleset>(
    initial?.override ?? { base: DEFAULT_RULE, perDimension: {} }
  );

  // Keyed by dimension across ALL categories, not just the current one.
  // Switching category hides inputs; holding their values here means switching
  // back restores what was typed instead of silently discarding it.
  const [measurements, setMeasurements] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const [k, v] of Object.entries(initial?.measurements ?? {})) {
      if (typeof v === 'number') seed[k] = String(v);
    }
    return seed;
  });

  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dims = useMemo(() => dimensionsForCategory(category), [category]);

  useEffect(() => {
    fetch('/api/fit-rulesets')
      .then(r => r.ok ? r.json() : { rulesets: [] })
      .then(d => setPresets(d.rulesets ?? []))
      .catch(() => setPresets([]));  // a failed load just means no presets offered
  }, []);

  // Presets load after first paint. Without a stand-in option, a garment whose
  // rule IS a preset would render with the select showing something else until
  // the fetch lands — the retailer would be looking at a rule that is not
  // their garment's. The saved value is unaffected — React state still holds
  // the real id — but showing someone else's rule invites them to "correct" it.
  const presetOptions = useMemo(() => {
    const list = [...presets];
    const initialId = initial?.ruleChoice.startsWith('preset:')
      ? initial.ruleChoice.slice('preset:'.length)
      : null;
    if (initialId && !list.some(p => p.id === initialId)) {
      list.unshift({ id: initialId, name: '…' });
    }
    return list;
  }, [presets, initial?.ruleChoice]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError(t.garmentNameRequired.th);
      return;
    }

    if (useOverride && !isRulesetValid(override)) {
      setError(t.fitRuleInvalid.th);
      return;
    }

    const active = activeMeasurements(measurements, category);
    if (active.length === 0) {
      setError(t.garmentNeedsMeasurement.th);
      return;
    }

    const photo = photoRef.current?.files?.[0] ?? null;
    if (!photo && !isEdit) {
      setError(t.photoRequired.th);
      return;
    }

    // Saving writes only the current category's dimensions, so warn before
    // a category change quietly discards numbers already entered.
    const stranded = strandedDimensions(measurements, category);
    if (stranded.length > 0) {
      const labels = stranded.map(k => dimensionByKey(k)?.labelTh ?? k).join(', ');
      if (!window.confirm(t.confirmDropMeasurements.th.replace('{dims}', labels))) return;
    }

    const form = new FormData();
    for (const [k, v] of Object.entries(buildGarmentFields({
      name, category, ruleChoice, useOverride, override, measurements,
      fallbackProfile: initial?.profileKey ?? 'regular',
    }))) form.set(k, v);
    if (photo) form.set('photo', photo);

    setLoading(true);
    try {
      const res = await fetch(
        mode === 'edit' ? `/api/garments/${initial.id}` : '/api/garments',
        { method: isEdit ? 'PATCH' : 'POST', body: form },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError.th);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      // Network failure (offline, timeout, DNS) — distinct from a rejection
      // by the API, which is handled above.
      setError(t.networkError.th);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{isEdit ? t.editGarment.th : t.addGarment.th}</h1>

      <label className="block">
        <span className="text-sm text-gray-700">{t.garmentName.th}</span>
        <input
          required value={name} onChange={e => setName(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.category.th}</span>
        <select
          required value={category}
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
          value={ruleChoice} onChange={e => setRuleChoice(e.target.value)}
          disabled={useOverride}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-60"
        >
          <optgroup label={t.fitRuleBuiltIn.th}>
            {FIT_PROFILES.map(p => (
              <option key={p.key} value={`profile:${p.key}`}>{p.labelTh}</option>
            ))}
          </optgroup>
          {presetOptions.length > 0 && (
            <optgroup label={t.fitRuleShopRules.th}>
              {presetOptions.map(p => <option key={p.id} value={`preset:${p.id}`}>{p.name}</option>)}
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
        <span className="text-sm text-gray-700">{isEdit ? t.replacePhoto.th : t.photo.th}</span>
        {isEdit && initial?.photo_url && (
          <span className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initial.photo_url} alt={t.currentPhoto.th}
              className="h-16 w-16 rounded object-cover"
            />
            <span className="text-xs text-gray-500">{t.photoKeepCurrent.th}</span>
          </span>
        )}
        <input
          ref={photoRef} required={!isEdit} type="file" accept="image/*"
          className="mt-1 block w-full text-sm"
        />
      </label>

      <fieldset className="space-y-3 rounded border p-4">
        <legend className="px-2 text-sm font-medium">{t.garmentMeasurements.th}</legend>
        {dims.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">{d.labelTh} (cm)</span>
            <input
              type="number" step="0.1" min="1" max="300" inputMode="decimal"
              value={measurements[d.key] ?? ''}
              onChange={e => setMeasurements(m => ({ ...m, [d.key]: e.target.value }))}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
      </fieldset>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit" disabled={loading}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? t.saving.th : t.save.th}
        </button>
        <Link href="/dashboard" className="text-sm text-gray-600 underline">{t.cancel.th}</Link>
      </div>
    </form>
  );
}
