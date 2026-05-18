import { useLanguage, type Language } from '../context/LanguageContext';
import { cn } from '../lib/utils';

const LANGS: { code: Language; label: string }[] = [
  { code: 'en', label: 'EN' },
  { code: 'tc', label: '繁' },
  { code: 'sc', label: '简' },
];

// Dark-theme toggle, fully independent of guest-kiosk's component.
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background-elevated p-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLanguage(l.code)}
          aria-pressed={language === l.code}
          className={cn(
            'min-w-10 rounded-full px-3 py-1.5 text-sm font-medium transition-all',
            language === l.code
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground-muted hover:text-foreground',
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
