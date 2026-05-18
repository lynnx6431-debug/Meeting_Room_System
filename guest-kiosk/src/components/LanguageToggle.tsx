import { useLanguage, type Language } from '../context/LanguageContext';
import { cn } from '../lib/utils';

const OPTIONS: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'tc', label: '繁' },
  { value: 'sc', label: '简' },
];

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-white/20 bg-white/10 p-1 shadow-sm backdrop-blur-sm">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLanguage(option.value)}
          aria-pressed={language === option.value}
          className={cn(
            'min-w-12 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
            language === option.value
              ? 'bg-white text-primary shadow-sm'
              : 'text-primary-foreground/75 hover:text-primary-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
