import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import i18n from '../i18n';

export type Language = 'en' | 'tc' | 'sc';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function normalizeLanguage(value?: string | null): Language {
  const raw = String(value || 'en');
  const lower = raw.toLowerCase();

  if (lower === 'tc' || lower.startsWith('zh-hk') || lower.startsWith('zh-tw')) {
    return 'tc';
  }
  if (lower === 'sc' || lower.startsWith('zh-cn') || lower.startsWith('zh-sg')) {
    return 'sc';
  }
  if (lower.startsWith('zh')) {
    return raw.includes('TW') || raw.includes('HK') ? 'tc' : 'sc';
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() =>
    normalizeLanguage(i18n.resolvedLanguage || i18n.language),
  );

  useEffect(() => {
    void i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage: (nextLanguage) => setLanguageState(nextLanguage),
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
}
