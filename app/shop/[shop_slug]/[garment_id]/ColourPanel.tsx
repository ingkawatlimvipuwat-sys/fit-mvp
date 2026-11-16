'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { t } from '@/lib/i18n/strings';

export default function ColourPanel({
  colours, trueColourPhotoUrl,
}: {
  colours: { hex: string; name: string }[];
  trueColourPhotoUrl: string | null;
}) {
  const [lang] = useLanguage();

  return (
    <div className="py-4">
      {colours.length > 0 && (
        <ul className="flex flex-wrap gap-4">
          {colours.map((c, i) => (
            <li key={i} className="w-16 text-center">
              {/* A thin border so white and near-white swatches still read as a
                  swatch rather than as a gap in the row. */}
              <span
                className="block h-12 w-12 rounded border border-control"
                style={{ backgroundColor: c.hex }}
                aria-hidden="true"
              />
              <span className="mt-1 block break-words text-xs text-ink">{c.name}</span>
              {/* The code itself, so a shopper can check or match the exact
                  colour rather than trusting their screen's rendering of it. */}
              <span className="block font-mono text-[10px] uppercase text-muted">{c.hex}</span>
            </li>
          ))}
        </ul>
      )}

      {trueColourPhotoUrl && (
        <figure className="mt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={trueColourPhotoUrl} alt="" className="w-full rounded-[14px]" />
          <figcaption className="mt-1 text-xs text-muted">
            {t.trueColourCaption[lang]}
          </figcaption>
        </figure>
      )}

      {/* Honest, one line, not a banner. */}
      <p className="mt-3 text-xs text-muted">{t.screenColourDisclaimer[lang]}</p>
    </div>
  );
}
