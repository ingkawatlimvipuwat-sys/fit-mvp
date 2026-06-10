'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'th' | 'en';

const KEY = 'fitmvp.lang';
const LangContext = createContext<[Lang, (l: Lang) => void]>(['th', () => {}]);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === 'en') setLangState('en');
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem(KEY, l);
  }

  return <LangContext.Provider value={[lang, setLang]}>{children}</LangContext.Provider>;
}

export function useLanguage(): [Lang, (l: Lang) => void] {
  return useContext(LangContext);
}
