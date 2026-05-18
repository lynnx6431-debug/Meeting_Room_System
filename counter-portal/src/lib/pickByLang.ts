import type { Language } from '../context/LanguageContext';

// Copied from guest-kiosk (the two apps are independent — no cross-import).
export function pickByLang(
  sources: { en?: string | null; tc?: string | null; sc?: string | null },
  lang: Language,
  fallback: string,
): string {
  const candidate = sources[lang]?.trim();
  if (candidate) {
    return candidate;
  }

  const enFallback = sources.en?.trim();
  if (enFallback) {
    return enFallback;
  }

  return fallback;
}
