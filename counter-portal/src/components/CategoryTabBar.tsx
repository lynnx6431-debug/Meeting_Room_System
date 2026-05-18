import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import type { OperatorCategory } from '../hooks/useOperatorCategories';
import { pickByLang } from '../lib/pickByLang';
import { cn } from '../lib/utils';

type Props = {
  categories: OperatorCategory[];
  defaultCategoryId: string | null;
  loading: boolean;
  activeTabId: string;
  onSelect: (tabId: string) => void;
};

export function CategoryTabBar({
  categories,
  defaultCategoryId,
  loading,
  activeTabId,
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  // Auto-select the operator's default category exactly once, on first data
  // load (V4.4 §5.3). A ref guard means a later manual click on "All" is
  // respected and not snapped back to the default tab.
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current) return;
    if (loading || categories.length === 0) return;
    autoSelected.current = true;
    if (defaultCategoryId && categories.some((c) => c.id === defaultCategoryId)) {
      onSelect(defaultCategoryId);
    }
  }, [loading, categories, defaultCategoryId, onSelect]);

  return (
    <div className="flex h-12 items-end gap-1 border-b border-border bg-background px-8">
      <TabButton
        label={t('tab.all')}
        count={0}
        active={activeTabId === 'all'}
        onClick={() => onSelect('all')}
      />

      {loading ? (
        <div className="px-4 py-3 text-xs text-foreground-subtle">{t('tab.loading')}</div>
      ) : (
        categories.map((cat) => (
          <TabButton
            key={cat.id}
            label={pickByLang(
              { en: cat.nameEn, tc: cat.nameTc, sc: cat.nameSc },
              language,
              cat.nameEn,
            )}
            count={0}
            active={activeTabId === cat.id}
            onClick={() => onSelect(cat.id)}
          />
        ))
      )}
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors',
        active
          ? 'border-accent text-foreground'
          : 'border-transparent text-foreground-muted hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'rounded px-1.5 py-0.5 text-xs',
          active ? 'bg-accent/15 text-accent' : 'bg-background-elevated text-foreground-subtle',
        )}
      >
        {count}
      </span>
    </button>
  );
}
