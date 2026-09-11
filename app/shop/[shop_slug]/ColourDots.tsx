'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';
import { dotsWithOverflow } from '@/lib/garment/colour-fabric-view';

export default function ColourDots({
  colours,
}: { colours: { hex: string; name: string }[] }) {
  const [lang] = useLanguage();
  if (colours.length === 0) return null;

  const { shown, extra } = dotsWithOverflow(colours);

  return (
    <div className="flex items-center gap-1">
      <ul className="flex items-center gap-1">
        {shown.map((c, i) => (
          <li
            key={i}
            // A thin border so a white or near-white colour still reads as a dot.
            className="h-3 w-3 rounded-full border border-gray-300"
            style={{ backgroundColor: c.hex }}
            title={c.name}
          />
        ))}
      </ul>
      {extra > 0 && (
        <span className="text-xs text-gray-500">
          {t.moreColours[lang].replace('{n}', String(extra))}
        </span>
      )}
    </div>
  );
}
