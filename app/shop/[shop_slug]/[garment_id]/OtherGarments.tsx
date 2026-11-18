'use client';
import Link from 'next/link';
import { t } from '@/lib/i18n/strings';
import { useLanguage } from '@/lib/hooks/useLanguage';

type OtherGarment = { id: string; name: string; photo_url: string; href: string };

export default function OtherGarments({ others }: { others: OtherGarment[] }) {
  const [lang] = useLanguage();

  if (others.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-ink">{t.otherGarments[lang]}</h2>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {others.map(g => (
          <Link
            key={g.id}
            href={g.href}
            className="flex min-h-[44px] w-24 shrink-0 flex-col gap-1"
          >
            <div className="h-24 w-24 overflow-hidden rounded-[10px] bg-[#DDE1E6]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.photo_url} alt={g.name} className="h-full w-full object-cover" />
            </div>
            <span className="truncate text-xs text-ink">{g.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
