'use client';
import { useLanguage } from '@/lib/hooks/useLanguage';

export default function LanguageToggle() {
  const [lang, setLang] = useLanguage();

  return (
    <div className="flex overflow-hidden rounded border border-gray-300 text-xs">
      {(['th', 'en'] as const).map(l => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-3 py-1.5 ${lang === l ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
