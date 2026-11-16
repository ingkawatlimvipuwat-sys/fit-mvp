'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import type { Colour } from '@/lib/garment/colour-fabric';
import Button from '@/app/components/ui/Button';
import FileInput from '@/app/components/ui/FileInput';
import TextButton from '@/app/components/ui/TextButton';
import { inputClass } from '@/app/components/ui/classes';

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
    <details open className="rounded-2xl border border-line bg-surface p-4">
      <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-semibold text-ink">{t.coloursSection[lang]}</summary>

      <ul className="mt-3 space-y-2">
        {colours.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2">
            <input
              type="color"
              value={c.hex}
              onChange={e => update(i, { hex: e.target.value })}
              className="h-11 w-14 rounded-[10px] border border-control bg-surface"
              aria-label={`${t.coloursSection[lang]} ${i + 1}`}
            />
            {/* The native picker swatch hides the value; the shopper page shows
                this code, so the retailer should see the same thing here. */}
            <span className="w-16 font-mono text-xs uppercase text-muted">{c.hex}</span>
            <input
              type="text"
              value={c.name}
              maxLength={40}
              placeholder={t.colourName[lang]}
              onChange={e => update(i, { name: e.target.value })}
              className={`${inputClass} grow basis-32`}
            />
            <TextButton tone="danger" onClick={() => onChange(colours.filter((_, j) => j !== i))}>
              {t.removeColour[lang]}
            </TextButton>
          </li>
        ))}
      </ul>

      <Button
        variant="secondary"
        className="mt-3 !h-11 !text-sm"
        onClick={() => onChange([...colours, { hex: '#000000', name: '' }])}
      >
        {t.addColour[lang]}
      </Button>

      <label className="mt-4 block text-sm font-semibold text-ink">
        {t.trueColourPhoto[lang]}
        {currentPhotoUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={currentPhotoUrl} alt="" className="mt-1 h-20 w-20 rounded-[10px] object-cover" />
        )}
        <FileInput name="true_colour_photo" accept="image/*" />
      </label>
    </details>
  );
}
