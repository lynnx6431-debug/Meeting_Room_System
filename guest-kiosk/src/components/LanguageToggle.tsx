import { useLanguage, type Language } from '../context/LanguageContext';
import { cn } from '../lib/utils';

const OPTIONS: Array<{ value: Language; label: string }> = [
  { value: 'en', label: 'EN' },
  { value: 'tc', label: '繁' },
  { value: 'sc', label: '简' },
];

type LanguageToggleVariant = 'onDark' | 'onLight';

type Props = {
  /**
   * 'onDark'  — for the green header (Welcome / Menu). Default.
   * 'onLight' — for light/beige backgrounds (Order Confirmation), where the
   *             glassy white style has zero contrast and the toggle vanishes.
   */
  variant?: LanguageToggleVariant;
};

export function LanguageToggle({ variant = 'onDark' }: Props) {
  const { language, setLanguage } = useLanguage();

  const containerClass =
    variant === 'onLight'
      ? 'border border-foreground/15 bg-foreground/5'
      : 'border border-white/20 bg-white/10 backdrop-blur-sm';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full p-1 shadow-sm',
        containerClass,
      )}
    >
      {OPTIONS.map((option) => {
        const active = language === option.value;
        const activeClass =
          variant === 'onLight'
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'bg-white text-primary shadow-sm';
        const inactiveClass =
          variant === 'onLight'
            ? 'text-foreground/70 hover:text-foreground'
            : 'text-primary-foreground/75 hover:text-primary-foreground';

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setLanguage(option.value)}
            aria-pressed={active}
            className={cn(
              'min-w-12 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all',
              active ? activeClass : inactiveClass,
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
