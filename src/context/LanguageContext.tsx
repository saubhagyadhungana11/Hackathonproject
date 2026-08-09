import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type en as enType } from '@/i18n/en';
import { ne } from '@/i18n/ne';

export type Language = 'en' | 'ne';
type Dict = typeof enType;

const dictionaries: Record<Language, Dict> = { en, ne: ne as unknown as Dict };

interface LanguageContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  toggle: () => void;
  t: Dict;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = 'sahayata-lang';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return stored === 'ne' ? 'ne' : 'en';
  });

  const setLang = (l: Language) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* noop */ }
  };

  const toggle = () => setLang(lang === 'en' ? 'ne' : 'en');

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t: dictionaries[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within LanguageProvider');
  return ctx;
}
