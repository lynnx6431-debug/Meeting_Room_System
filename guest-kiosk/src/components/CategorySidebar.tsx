import { useNavigate } from 'react-router-dom';
import { pickByLang } from '../lib/pickByLang';
import type { MenuCategory } from '../hooks/useMenu';
import { useLanguage } from '../context/LanguageContext';
import { useTranslation } from 'react-i18next';

type CategorySidebarProps = {
  categories: MenuCategory[];
  currentCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  headcount: number;
  usage: Record<string, number>;
};

export function CategorySidebar({
  categories,
  currentCategoryId,
  onSelect,
  headcount,
  usage,
}: CategorySidebarProps) {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <aside className="border-b border-foreground/10 bg-background lg:flex lg:h-full lg:w-64 lg:flex-col lg:border-b-0 lg:border-r">
      <div className="hidden border-b border-foreground/10 px-6 py-4 lg:block">
        <button
          type="button"
          onClick={() => navigate('/?from=menu')}
          className="flex items-center gap-1 text-xs text-foreground/50 transition-colors hover:text-foreground/80"
        >
          <span>&lsaquo;</span>
          <span>{t('menu.backToHome')}</span>
        </button>
      </div>

      <div className="border-b border-foreground/10 px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => navigate('/?from=menu')}
          className="flex items-center gap-1 text-xs text-foreground/50 transition-colors hover:text-foreground/80"
        >
          <span>&lsaquo;</span>
          <span>{t('menu.backToHome')}</span>
        </button>
      </div>

      <div className="overflow-x-auto bg-background lg:hidden">
        <nav className="flex gap-2 px-3 py-3 whitespace-nowrap">
          {categories.map((category) => {
            const name = pickByLang(
              { en: category.nameEn, tc: category.nameTc, sc: category.nameSc },
              language,
              category.nameEn,
            );
            const used = usage[category.id] || 0;
            const isActive = currentCategoryId === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                className={[
                  'rounded-full border px-4 py-2 text-sm transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-foreground/10 bg-white text-foreground/75',
                ].join(' ')}
              >
                {name} {used}/{headcount}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden lg:flex lg:flex-1 lg:flex-col">
        <div className="px-6 py-3">
          <div className="text-xs uppercase tracking-[0.28em] text-foreground/40">{t('menu.catalogue')}</div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {categories.map((category) => {
            const name = pickByLang(
              { en: category.nameEn, tc: category.nameTc, sc: category.nameSc },
              language,
              category.nameEn,
            );
            const used = usage[category.id] || 0;
            const isActive = currentCategoryId === category.id;

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelect(category.id)}
                className={[
                  'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-foreground/80 hover:bg-foreground/5',
                ].join(' ')}
              >
                <span className={isActive ? 'font-medium' : ''}>{name}</span>
                <span className={isActive ? 'text-xs opacity-80' : 'text-xs text-foreground/40'}>
                  {used}/{headcount}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-foreground/10 px-6 py-4 text-xs">
          <div className="mb-1 uppercase tracking-[0.28em] text-foreground/40">{t('menu.needHelp')}</div>
          <div className="text-foreground/60">{t('menu.needHelpBody')}</div>
        </div>
      </div>
    </aside>
  );
}
