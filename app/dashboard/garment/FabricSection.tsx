'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t, type StringKey } from '@/lib/i18n/strings';
import { FABRIC_CHIPS, FABRIC_FIELDS, chipStringKey, type FabricChipKey } from '@/lib/garment/colour-fabric';
import { TECHNICAL_FIELDS } from '@/lib/garment/colour-fabric-view';

/** Every fabric field as the form holds it: strings, '' meaning "not set". */
export type FabricFormState = Record<string, string>;

export function emptyFabricForm(): FabricFormState {
  return Object.fromEntries(FABRIC_FIELDS.map(k => [k, '']));
}

/** 'weight_gsm' -> 'weightGsm', matching the i18n key names. */
function labelKey(field: string): StringKey {
  return field.split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') as StringKey;
}

const NUMERIC: Record<string, { step: string; max: number }> = {
  weight_gsm:   { step: '1', max: 2000 },
  thread_count: { step: '1', max: 2000 },
  pore_size_mm: { step: '0.001', max: 999.999 },
};

export default function FabricSection({
  fabric, onChange, currentPhotoUrl,
}: {
  fabric: FabricFormState;
  onChange: (next: FabricFormState) => void;
  currentPhotoUrl?: string | null;
}) {
  const [lang] = useLanguage();
  const set = (k: string, v: string) => onChange({ ...fabric, [k]: v });

  return (
    <details open className="rounded border p-4">
      <summary className="cursor-pointer font-medium">{t.fabricSection[lang]}</summary>

      {(Object.keys(FABRIC_CHIPS) as FabricChipKey[]).map(group => (
        <fieldset key={group} className="mt-3">
          <legend className="text-sm font-medium">{t[group][lang]}</legend>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {/* "Not set" is a real option, not the absence of one: the retailer
                must be able to take a claim back off the garment. */}
            <label className="flex items-center gap-1">
              <input
                type="radio" name={`fabric_${group}`} value=""
                checked={(fabric[group] ?? '') === ''}
                onChange={() => set(group, '')}
              />
              {t.notSet[lang]}
            </label>
            {FABRIC_CHIPS[group].map(v => (
              <label key={v} className="flex items-center gap-1">
                <input
                  type="radio" name={`fabric_${group}`} value={v}
                  checked={fabric[group] === v}
                  onChange={() => set(group, v)}
                />
                {t[chipStringKey(group, v) as StringKey][lang]}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm">{t.fabricTechnicalDetails[lang]}</summary>
        <div className="mt-2 space-y-2">
          {TECHNICAL_FIELDS.map(field => {
            const num = NUMERIC[field];
            return (
              <label key={field} className="block text-sm">
                {t[labelKey(field)][lang]}
                {field === 'notes' ? (
                  <textarea
                    value={fabric[field] ?? ''} rows={3} maxLength={2000}
                    onChange={e => set(field, e.target.value)}
                    className="mt-1 w-full rounded border px-2 py-1.5"
                  />
                ) : (
                  <input
                    type={num ? 'number' : 'text'}
                    step={num?.step} min={num ? 0 : undefined} max={num?.max}
                    maxLength={num ? undefined : 200}
                    value={fabric[field] ?? ''}
                    onChange={e => set(field, e.target.value)}
                    className="mt-1 w-full rounded border px-2 py-1.5"
                  />
                )}
              </label>
            );
          })}
        </div>
      </details>

      <label className="mt-4 block text-sm">
        {t.fabricPhoto[lang]}
        {currentPhotoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentPhotoUrl} alt="" className="mt-1 h-20 w-20 rounded object-cover" />
        )}
        <input type="file" name="fabric_photo" accept="image/*" className="mt-1 block" />
      </label>
    </details>
  );
}
