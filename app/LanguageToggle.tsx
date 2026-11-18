'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';

/** Shared TH/EN pill. It always sits on a white surface (shop, auth and dashboard headers). */
export default function LanguageToggle() {
  const [lang, setLang] = useLanguage();

  return (
    <div className="flex overflow-hidden rounded-full border border-control text-xs font-semibold">
      {(['th', 'en'] as const).map(l => {
        const active = lang === l;
        const style = active ? 'bg-ink text-white' : 'text-muted hover:bg-page';
        return (
          <button key={l} onClick={() => setLang(l)} className={`min-h-[44px] px-3.5 text-[13px] ${style}`}>
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
