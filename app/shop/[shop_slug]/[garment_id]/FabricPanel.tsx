'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t, type StringKey } from '@/lib/i18n/strings';
import { chipStringKey } from '@/lib/garment/colour-fabric';
import { visibleChips, technicalRows } from '@/lib/garment/colour-fabric-view';
import type { GarmentFabric } from '@/lib/supabase/types';

/** Monochrome, simple, one per chip group. */
const ICONS: Record<string, React.ReactNode> = {
  finish:    <circle cx="8" cy="8" r="6" />,
  thickness: <><rect x="2" y="5" width="12" height="2" /><rect x="2" y="9" width="12" height="3" /></>,
  stretch:   <><path d="M2 8h12" /><path d="M2 5v6" /><path d="M14 5v6" /></>,
  feel:      <path d="M2 10c2-4 4 4 6 0s4-4 6 0" />,
};

/** 'weight_gsm' -> 'weightGsm', matching the i18n key names. */
function labelKey(field: string): StringKey {
  return field.split('_')
    .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join('') as StringKey;
}

export default function FabricPanel({ fabric }: { fabric: GarmentFabric }) {
  const [lang] = useLanguage();
  const chips = visibleChips(fabric);
  const rows = technicalRows(fabric);

  return (
    <div className="py-4">
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {chips.map(c => (
            <li
              key={c.group}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
            >
              <svg
                viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"
                fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-500"
              >
                {ICONS[c.group]}
              </svg>
              {t[chipStringKey(c.group, c.value) as StringKey][lang]}
            </li>
          ))}
        </ul>
      )}

      {fabric.fabric_photo_url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={fabric.fabric_photo_url} alt="" className="mt-4 w-full rounded" />
      )}

      {rows.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600">
            {t.fabricTechnicalDetails[lang]}
          </summary>
          <dl className="mt-2 text-sm">
            {rows.map(r => (
              <div key={r.key} className="flex gap-4 py-0.5">
                <dt className="w-32 shrink-0 text-gray-500">{t[labelKey(r.key)][lang]}</dt>
                {/* The retailer's own words, shown as-is. React escapes it. */}
                <dd className="break-words">{r.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
