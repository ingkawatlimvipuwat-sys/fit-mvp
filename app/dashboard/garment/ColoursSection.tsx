'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import type { Colour } from '@/lib/garment/colour-fabric';

export default function ColoursSection({
  colours, onChange, currentPhotoUrl,
}: {
  colours: Colour[];
  onChange: (next: Colour[]) => void;
  /** Edit mode: the true-colour photo already stored, if any. */
  currentPhotoUrl?: string | null;
}) {
  const [lang] = useLanguage();

  function update(i: number, patch: Partial<Colour>) {
    onChange(colours.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  return (
    <details open className="rounded border p-4">
      <summary className="cursor-pointer font-medium">{t.coloursSection[lang]}</summary>

      <ul className="mt-3 space-y-2">
        {colours.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            <input
              type="color"
              value={c.hex}
              onChange={e => update(i, { hex: e.target.value })}
              className="h-9 w-12 rounded border"
              aria-label={`${t.coloursSection[lang]} ${i + 1}`}
            />
            <input
              type="text"
              value={c.name}
              maxLength={40}
              placeholder={t.colourName[lang]}
              onChange={e => update(i, { name: e.target.value })}
              className="flex-1 rounded border px-2 py-1.5"
            />
            <button
              type="button"
              onClick={() => onChange(colours.filter((_, j) => j !== i))}
              className="px-2 py-1 text-sm text-red-600"
            >
              {t.removeColour[lang]}
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => onChange([...colours, { hex: '#000000', name: '' }])}
        className="mt-3 rounded border px-3 py-1.5 text-sm"
      >
        {t.addColour[lang]}
      </button>

      <label className="mt-4 block text-sm">
        {t.trueColourPhoto[lang]}
        {currentPhotoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentPhotoUrl} alt="" className="mt-1 h-20 w-20 rounded object-cover" />
        )}
        <input type="file" name="true_colour_photo" accept="image/*" className="mt-1 block" />
      </label>
    </details>
  );
}
