'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t, type StringKey } from '@/lib/i18n/strings';
import { FABRIC_CHIPS, chipStringKey, type FabricChipKey, type FabricFormState } from '@/lib/garment/colour-fabric';
import { TECHNICAL_FIELDS } from '@/lib/garment/colour-fabric-view';
import CheckRow from '@/app/components/ui/CheckRow';
import Field from '@/app/components/ui/Field';
import FileInput from '@/app/components/ui/FileInput';
import Textarea from '@/app/components/ui/Textarea';

/** 'weight_gsm' -> 'weightGsm', matching the i18n key names. */
function labelKey(field: string): StringKey {
  return field.split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') as StringKey;
}

/** Chip groups whose words need a numeric anchor to mean anything. */
const GROUP_HINTS: Partial<Record<FabricChipKey, StringKey>> = {
  thickness: 'thicknessHint',
  stretch: 'stretchHint',
};

const NUMERIC: Record<string, { step: string; max: number }> = {
  weight_gsm:   { step: '1', max: 2000 },
  thread_count: { step: '1', max: 2000 },
  pore_size_mm: { step: '0.001', max: 999.999 },
};

export default function FabricSection({
  fabric, onChange, currentPhotoUrl, removePhoto, onRemovePhotoChange,
}: {
  fabric: FabricFormState;
  onChange: (next: FabricFormState) => void;
  currentPhotoUrl?: string | null;
  /** Ticked = the retailer wants the current photo taken off (a new file still wins). */
  removePhoto: boolean;
  onRemovePhotoChange: (v: boolean) => void;
}) {
  const [lang] = useLanguage();
  const set = (k: string, v: string) => onChange({ ...fabric, [k]: v });

  return (
    <details open className="rounded-2xl border border-line bg-surface p-4">
      <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-semibold text-ink">{t.fabricSection[lang]}</summary>

      {(Object.keys(FABRIC_CHIPS) as FabricChipKey[]).map(group => (
        <fieldset key={group} className="mt-3">
          <legend className="text-sm font-semibold text-ink">{t[group][lang]}</legend>
          {GROUP_HINTS[group] && (
            // The anchor that makes "thin" mean the same thing to every
            // retailer. Without it each shop guesses its own scale.
            <p className="mt-0.5 text-xs text-muted">{t[GROUP_HINTS[group]][lang]}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-x-4">
            {/* "Not set" is a real option, not the absence of one: the retailer
                must be able to take a claim back off the garment. */}
            <CheckRow
              type="radio" name={`fabric_${group}`} value=""
              checked={(fabric[group] ?? '') === ''}
              onChange={() => set(group, '')}
            >
              {t.notSet[lang]}
            </CheckRow>
            {FABRIC_CHIPS[group].map(v => (
              <CheckRow
                key={v}
                type="radio" name={`fabric_${group}`} value={v}
                checked={fabric[group] === v}
                onChange={() => set(group, v)}
              >
                {t[chipStringKey(group, v) as StringKey][lang]}
              </CheckRow>
            ))}
          </div>
        </fieldset>
      ))}

      <details className="mt-4">
        <summary className="flex min-h-[44px] cursor-pointer items-center text-sm font-medium text-accent">{t.fabricTechnicalDetails[lang]}</summary>
        <div className="mt-2 space-y-3">
          {TECHNICAL_FIELDS.map(field => {
            const num = NUMERIC[field];
            return (
field === 'notes' ? (
                <Textarea
                  key={field}
                  label={t[labelKey(field)][lang]}
                  value={fabric[field] ?? ''} rows={3} maxLength={2000}
                  onChange={e => set(field, e.target.value)}
                />
              ) : (
                <Field
                  key={field}
                  label={t[labelKey(field)][lang]}
                  type={num ? 'number' : 'text'}
                  step={num?.step} min={num ? 0 : undefined} max={num?.max}
                  maxLength={num ? undefined : 200}
                  value={fabric[field] ?? ''}
                  placeholder={field === 'construction' ? t.constructionHint[lang] : undefined}
                  onChange={e => set(field, e.target.value)}
                />
              )
            );
          })}
        </div>
      </details>

      <div className="mt-4 text-sm">
        <label htmlFor="fabric_photo" className="block font-semibold text-ink">{t.fabricPhoto[lang]}</label>
        {currentPhotoUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentPhotoUrl} alt=""
              className={`mt-1 block h-20 w-20 rounded-[10px] object-cover ${removePhoto ? 'opacity-40' : ''}`}
            />
            <CheckRow
              type="checkbox" checked={removePhoto}
              onChange={e => onRemovePhotoChange(e.target.checked)}
            >
              {t.removeFabricPhoto[lang]}
            </CheckRow>
          </>
        )}
        <FileInput id="fabric_photo" name="fabric_photo" accept="image/*" />
      </div>
    </details>
  );
}
