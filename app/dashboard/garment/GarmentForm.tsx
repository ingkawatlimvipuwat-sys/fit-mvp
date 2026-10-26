'use client';
import { useMemo, useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { dimensionsForCategory, dimensionByKey } from '@/lib/config/dimensions';
import { FIT_PROFILES } from '@/lib/config/fit-profiles';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';
import type { Category, MeasurementBag } from '@/lib/supabase/types';
import FitRuleEditor, { isRulesetValid } from '@/app/dashboard/fit-rules/FitRuleEditor';
import { DEFAULT_RULE } from '@/lib/fit/rules';
import type { FitRuleset } from '@/lib/fit/rules';
import { activeMeasurements, strandedDimensions, buildGarmentFields } from '@/lib/garment/form-fields';
import type { MeasurementBaseline } from '@/lib/garment/form-fields';
import ColoursSection from '@/app/dashboard/garment/ColoursSection';
import FabricSection from '@/app/dashboard/garment/FabricSection';
import { SIZE_LABELS, sizeLabelText } from '@/lib/garment/size-label';
import { seedOverrideFrom, shouldSeedOverride } from '@/lib/fit/override-seed';
import { presetOptionsFor } from '@/lib/fit/preset-options';
import type { PresetOption, PresetsStatus } from '@/lib/fit/preset-options';
import type { PickerDef } from '@/lib/catalogue/picks';
import { emptyFabricForm, type FabricFormState, type Colour } from '@/lib/garment/colour-fabric';

/** Numeric measurements come in as numbers; form inputs need strings. Shared
 * by the `measurements` state initializer and the dirty-check baseline below
 * so the two can never drift apart. */
function seedMeasurements(bag?: MeasurementBag): Record<string, string> {
  const seed: Record<string, string> = {};
  for (const [k, v] of Object.entries(bag ?? {})) {
    if (typeof v === 'number') seed[k] = String(v);
  }
  return seed;
}

/** Everything edit mode needs to reproduce a garment's current state. */
export interface GarmentFormInitial {
  id: string;
  name: string;
  category: Category;
  sizeLabel: string;
  /** One value per picker, keyed by picker id. Only used inside a product. */
  picks?: Record<string, string>;
  photo_url: string;
  measurements: MeasurementBag;
  /** From ruleSelectionForGarment() — see lib/fit/rule-selection.ts. */
  useOverride: boolean;
  override: FitRuleset;
  ruleChoice: string;
  profileKey: string;
  colours: Colour[];
  true_colour_photo_url: string | null;
  fabric: FabricFormState;
  fabric_photo_url: string | null;
}

/** Set when the garment is a version of a product: the name is the product's and picks replace the size label. */
export interface ProductCtx {
  id: string;
  name: string;
  pickers: PickerDef[];
  /** Values already used per picker id, in first-used order, offered as suggestions. */
  usedValues: Record<string, string[]>;
}

type GarmentFormProps =
  | { mode: 'create'; initial?: GarmentFormInitial; copyFrom?: string; productCtx?: ProductCtx }
  | { mode: 'edit'; initial: GarmentFormInitial; copyFrom?: undefined; productCtx?: ProductCtx };

export default function GarmentForm({ mode, initial, copyFrom, productCtx }: GarmentFormProps) {
  const router = useRouter();
  const [lang] = useLanguage();
  const isEdit = mode === 'edit';
  const photoRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(productCtx?.name ?? initial?.name ?? '');
  const [picks, setPicks] = useState<Record<string, string>>(initial?.picks ?? {});
  const [category, setCategory] = useState<Category>(initial?.category ?? 'top');
  const [sizeLabel, setSizeLabel] = useState(initial?.sizeLabel ?? '');
  const [ruleChoice, setRuleChoice] = useState(initial?.ruleChoice ?? 'profile:regular');
  const [useOverride, setUseOverride] = useState(initial?.useOverride ?? false);
  const [override, setOverride] = useState<FitRuleset>(
    initial?.override ?? { base: DEFAULT_RULE, perDimension: {} }
  );
  // Set once the retailer has actually edited the override in this session
  // (via FitRuleEditor) — as opposed to it merely being seeded when the
  // checkbox was ticked. Ticking off and back on must not clobber real edits.
  const editedOverrideRef = useRef(false);

  // Keyed by dimension across ALL categories, not just the current one.
  // Switching category hides inputs; holding their values here means switching
  // back restores what was typed instead of silently discarding it.
  const [measurements, setMeasurements] = useState<Record<string, string>>(
    () => seedMeasurements(initial?.measurements)
  );

  const [colours, setColours] = useState<Colour[]>(initial?.colours ?? []);
  const [fabric, setFabric] = useState<FabricFormState>(initial?.fabric ?? emptyFabricForm());

  // The garment as the form opened, so strandedDimensions() only warns about
  // measurements lost by the retailer's own changes (2026-10-26, #8).
  const [baseline] = useState<MeasurementBaseline>(() => ({
    category: initial?.category ?? 'top',
    measurements: seedMeasurements(initial?.measurements),
  }));

  // Unsaved-work guard baseline (UX audit 2026-08-18, D2): the form's state on
  // first render, in create mode the empty defaults, in edit mode `initial`.
  // Captured once via lazy useState init so later edits never move the goalposts.
  const [initialSnapshot] = useState(() => JSON.stringify({
    name: initial?.name ?? '',
    category: initial?.category ?? 'top',
    sizeLabel: initial?.sizeLabel ?? '',
    picks: initial?.picks ?? {},
    ruleChoice: initial?.ruleChoice ?? 'profile:regular',
    useOverride: initial?.useOverride ?? false,
    override: initial?.override ?? { base: DEFAULT_RULE, perDimension: {} },
    measurements: seedMeasurements(initial?.measurements),
    colours: initial?.colours ?? [],
    fabric: initial?.fabric ?? emptyFabricForm(),
  }));

  const [presets, setPresets] = useState<PresetOption[]>([]);
  const [overrideNotice, setOverrideNotice] = useState<string | null>(null);
  const [presetsStatus, setPresetsStatus] = useState<PresetsStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dims = useMemo(() => dimensionsForCategory(category), [category]);

  // Same shape as initialSnapshot above — a plain JSON.stringify comparison is
  // enough for this MVP-sized, plain-object state.
  function isDirty(): boolean {
    const current = JSON.stringify({
      name, category, sizeLabel, picks, ruleChoice, useOverride, override, measurements, colours, fabric,
    });
    return current !== initialSnapshot || (photoRef.current?.files?.length ?? 0) > 0;
  }

  useEffect(() => {
    fetch('/api/fit-rulesets')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setPresets(Array.isArray(d?.rulesets) ? d.rulesets : []); setPresetsStatus('ready'); })
      .catch(() => setPresetsStatus('failed'));
  }, []);

  // Presets load after first paint. Without a stand-in option, a garment whose
  // rule IS a preset would render with the select showing something else until
  // the fetch lands — the retailer would be looking at a rule that is not
  // their garment's. The saved value is unaffected — React state still holds
  // the real id — but showing someone else's rule invites them to "correct" it.
  const presetOptions = useMemo(
    () => presetOptionsFor(presets, initial?.ruleChoice, presetsStatus),
    [presets, initial?.ruleChoice, presetsStatus],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // Captured first thing: React nulls `currentTarget` once the handler stops
    // running synchronously, so reading it after any future `await` added above
    // would silently yield no photo files and no error. Hold the node instead.
    const formEl = e.currentTarget;

    if (!name.trim()) {
      setError(t.garmentNameRequired[lang]);
      return;
    }

    if (useOverride && !isRulesetValid(override)) {
      setError(t.fitRuleInvalid[lang]);
      return;
    }

    const active = activeMeasurements(measurements, category);
    if (active.length === 0) {
      setError(t.garmentNeedsMeasurement[lang]);
      return;
    }

    if (productCtx && productCtx.pickers.some(pk => (picks[pk.id] ?? '').trim() === '')) {
      setError(t.pickRequired[lang]);
      return;
    }

    const photo = photoRef.current?.files?.[0] ?? null;
    if (!photo && !isEdit && !copyFrom) {
      setError(t.photoRequired[lang]);
      return;
    }

    // A row the retailer added and never filled in is dropped as a kindness.
    // A row with a chosen colour but no name is an error they must resolve.
    const cleanColours = colours.filter(c => c.name.trim() !== '' || c.hex !== '#000000');
    if (cleanColours.some(c => c.name.trim() === '')) {
      setError(t.colourNameRequired[lang]);
      return;
    }

    // Saving writes only the current category's dimensions, so warn before
    // a category change quietly discards numbers already entered.
    const stranded = strandedDimensions(measurements, category, baseline);
    if (stranded.length > 0) {
      const labels = stranded
        .map(k => {
          const d = dimensionByKey(k);
          return (lang === 'th' ? d?.labelTh : d?.labelEn) ?? k;
        })
        .join(', ');
      if (!window.confirm(t.confirmDropMeasurements[lang].replace('{dims}', labels))) return;
    }

    const trueColourFile =
      (formEl.elements.namedItem('true_colour_photo') as HTMLInputElement | null)?.files?.[0] ?? null;
    const fabricPhotoFile =
      (formEl.elements.namedItem('fabric_photo') as HTMLInputElement | null)?.files?.[0] ?? null;

    const form = new FormData();
    for (const [k, v] of Object.entries(buildGarmentFields({
      name, category, sizeLabel, ruleChoice, useOverride, override, measurements,
      fallbackProfile: initial?.profileKey ?? 'regular',
    }))) form.set(k, v);
    if (photo) form.set('photo', photo);
    if (productCtx) {
      form.set('picks', JSON.stringify(picks));
      // Edit keeps the stored product; only a new version names one.
      if (!isEdit) form.set('product_id', productCtx.id);
      if (copyFrom) form.set('copy_from', copyFrom);
    }

    // colours/fabric must ALWAYS be set, even when empty: presence tells the
    // API "this is the truth, replace it" — omitting them when empty would
    // make it impossible to delete a retailer's last colour or fabric detail.
    form.set('colours', JSON.stringify(cleanColours.map(c => ({ hex: c.hex, name: c.name.trim() }))));
    form.set('fabric', JSON.stringify(fabric));
    if (trueColourFile) form.set('true_colour_photo', trueColourFile);
    if (fabricPhotoFile) form.set('fabric_photo', fabricPhotoFile);

    setLoading(true);
    try {
      const res = await fetch(
        mode === 'edit' ? `/api/garments/${initial.id}` : '/api/garments',
        { method: isEdit ? 'PATCH' : 'POST', body: form },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === 'string' ? data.error : t.authError[lang]);
        return;
      }
      router.push(productCtx ? `/dashboard/product/${productCtx.id}` : '/dashboard');
      router.refresh();
    } catch {
      // Network failure (offline, timeout, DNS) — distinct from a rejection
      // by the API, which is handled above.
      setError(t.networkError[lang]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <h1 className="text-xl font-semibold">{isEdit ? t.editGarment[lang] : t.addGarment[lang]}</h1>

      {productCtx ? (
        <>
          <p className="text-sm text-gray-600">{productCtx.name}</p>
          {productCtx.pickers.map(pk => (
            <label key={pk.id} className="block">
              <span className="text-sm text-gray-700">{pk.name}</span>
              <input
                required list={`picker-values-${pk.id}`}
                value={picks[pk.id] ?? ''}
                onChange={e => setPicks(prev => ({ ...prev, [pk.id]: e.target.value }))}
                className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
              />
              <datalist id={`picker-values-${pk.id}`}>
                {(productCtx.usedValues[pk.id] ?? []).map(v => <option key={v} value={v} />)}
              </datalist>
            </label>
          ))}
        </>
      ) : (
        <label className="block">
          <span className="text-sm text-gray-700">{t.garmentName[lang]}</span>
          <input
            required value={name} onChange={e => setName(e.target.value)}
            className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
          />
        </label>
      )}

      <label className="block">
        <span className="text-sm text-gray-700">{t.category[lang]}</span>
        <select
          required value={category}
          onChange={e => setCategory(e.target.value as Category)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="top">{t.catTop[lang]}</option>
          <option value="bottom">{t.catBottom[lang]}</option>
          <option value="dress">{t.catDress[lang]}</option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.sizeLabel[lang]}</span>
        <select
          value={sizeLabel} onChange={e => setSizeLabel(e.target.value)}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
        >
          <option value="">{t.sizeNone[lang]}</option>
          {SIZE_LABELS.map(c => <option key={c} value={c}>{sizeLabelText(c, lang)}</option>)}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-gray-700">{t.fitProfile[lang]}</span>
        <select
          value={ruleChoice} onChange={e => { setRuleChoice(e.target.value); setOverrideNotice(null); }}
          disabled={useOverride}
          className="mt-1 block w-full rounded border border-gray-300 px-3 py-2 disabled:opacity-60"
        >
          <optgroup label={t.fitRuleBuiltIn[lang]}>
            {FIT_PROFILES.map(p => (
              <option key={p.key} value={`profile:${p.key}`}>{lang === 'th' ? p.labelTh : p.labelEn}</option>
            ))}
          </optgroup>
          {presetOptions.length > 0 && (
            <optgroup label={t.fitRuleShopRules[lang]}>
              {presetOptions.map(p => (
                <option key={p.id} value={`preset:${p.id}`}>
                  {p.placeholder === 'loading' ? t.presetLoading[lang]
                    : p.placeholder === 'unavailable' ? t.presetUnavailable[lang]
                    : p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        {presetsStatus === 'failed' && (
          <span className="mt-1 block text-sm text-red-600">{t.fitRulesLoadFailed[lang]}</span>
        )}
      </label>

      <div className="space-y-3 rounded border p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={useOverride}
            onChange={e => {
              const on = e.target.checked;
              // Capture before the preset->profile reassignment just below —
              // otherwise a preset-backed garment would always seed from the
              // fallback profile below, never from the preset it was actually
              // using.
              const priorChoice = ruleChoice;
              setOverrideNotice(null);
              // D3: the editor used to always open on DEFAULT_RULE regardless
              // of the rule actually governing this garment, so any dimension
              // left untouched would silently revert to the global default.
              // Seed unless there was an override in force when the form
              // opened (it is already in state) or the retailer has edited the
              // override this session — toggling off and back on must not
              // clobber real edits. NB: `initial.override` is never null for an
              // existing garment (it holds a blank), so test `useOverride`.
              if (shouldSeedOverride(on, initial?.useOverride ?? false, editedOverrideRef.current)) {
                const seed = seedOverrideFrom(priorChoice, presets);
                if (seed === null) {
                  // The preset's numbers are not available: refuse rather than
                  // start from the default rule.
                  setOverrideNotice(presetsStatus === 'loading' ? t.presetRuleStillLoading[lang] : t.presetRuleUnavailable[lang]);
                  return; // checkbox stays unticked (controlled)
                }
                setOverride(seed);
              }
              setUseOverride(on);
              // A garment cannot hold both an override and a preset (spec
              // §6.1), so ticking this drops the preset link on save. Move the
              // now-disabled select onto the profile the garment will actually
              // fall back to, rather than leaving it displaying a preset that
              // is about to be discarded. Mirrors what ruleSelectionForGarment
              // does when reading a stored override back.
              if (on && priorChoice.startsWith('preset:')) {
                setRuleChoice(`profile:${initial?.profileKey ?? 'regular'}`);
              }
            }}
          />
          <span>{t.fitRuleOverride[lang]}</span>
        </label>
        {overrideNotice && <p className="text-sm text-red-600">{overrideNotice}</p>}
        {useOverride && (
          <FitRuleEditor
            value={override}
            onChange={next => {
              editedOverrideRef.current = true;
              setOverride(next);
            }}
          />
        )}
      </div>

      <label className="block">
        <span className="text-sm text-gray-700">{isEdit || copyFrom ? t.replacePhoto[lang] : t.photo[lang]}</span>
        {(isEdit || copyFrom) && initial?.photo_url && (
          <span className="mt-2 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={initial.photo_url} alt={t.currentPhoto[lang]}
              className="h-16 w-16 rounded object-cover"
            />
            <span className="text-xs text-gray-500">{t.photoKeepCurrent[lang]}</span>
          </span>
        )}
        <input
          ref={photoRef} required={!isEdit && !copyFrom} type="file" accept="image/*"
          className="mt-1 block w-full text-sm"
        />
      </label>

      <fieldset className="space-y-3 rounded border p-4">
        <legend className="px-2 text-sm font-medium">{t.garmentMeasurements[lang]}</legend>
        {dims.map(d => (
          <label key={d.key} className="block">
            <span className="text-sm text-gray-700">{lang === 'th' ? d.labelTh : d.labelEn} (cm)</span>
            <input
              type="number" step="0.1" min="1" max="300" inputMode="decimal"
              value={measurements[d.key] ?? ''}
              onChange={e => setMeasurements(m => ({ ...m, [d.key]: e.target.value }))}
              className="mt-1 block w-full rounded border border-gray-300 px-3 py-2"
            />
          </label>
        ))}
      </fieldset>

      <ColoursSection
        colours={colours}
        onChange={setColours}
        currentPhotoUrl={initial?.true_colour_photo_url ?? null}
      />
      <FabricSection
        fabric={fabric}
        onChange={setFabric}
        currentPhotoUrl={initial?.fabric_photo_url ?? null}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          type="submit" disabled={loading}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-60"
        >
          {loading ? t.saving[lang] : t.save[lang]}
        </button>
        <Link
          href={productCtx ? `/dashboard/product/${productCtx.id}` : '/dashboard'}
          className="text-sm text-gray-600 underline"
          onClick={e => {
            // Only prompt when there's actually something to lose — a confirm
            // on an untouched form is worse than none.
            if (isDirty() && !window.confirm(t.confirmDiscard[lang])) {
              e.preventDefault();
            }
          }}
        >
          {t.cancel[lang]}
        </Link>
      </div>
    </form>
  );
}
