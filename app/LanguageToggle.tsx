'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';

/**
 * Shared TH/EN control. It sits on two different surfaces — the white shop and
 * auth headers, and the dark dashboard header — so the active state has to
 * invert rather than being a fixed dark pill: `bg-gray-900` is invisible
 * against a `bg-gray-900` header. Default stays `light`, so the customer side
 * and the auth pages render exactly as before.
 */
export default function LanguageToggle({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  const [lang, setLang] = useLanguage();
  const dark = tone === 'dark';

  return (
    <div className={`flex overflow-hidden border text-xs ${dark ? 'rounded border-gray-600' : 'rounded-full border-control font-semibold'}`}>
      {(['th', 'en'] as const).map(l => {
        const active = lang === l;
        const style = active
          ? (dark ? 'bg-white text-gray-900' : 'bg-ink text-white')
          : (dark ? 'text-gray-300 hover:bg-white/10' : 'text-muted hover:bg-page');
        return (
          <button key={l} onClick={() => setLang(l)} className={`${dark ? 'px-3 py-1.5' : 'min-h-[44px] px-3.5 text-[13px]'} ${style}`}>
            {l.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
