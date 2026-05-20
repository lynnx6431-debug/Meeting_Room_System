import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import type { OperatorCategory } from '../hooks/useOperatorCategories';
import { useOperatorStats, type OperatorStats } from '../hooks/useOperatorStats';
import { cn } from '../lib/utils';
import { pickByLang } from '../lib/pickByLang';

const KPI_ITEMS: { key: keyof OperatorStats; isWarning?: boolean }[] = [
  { key: 'pending' },
  { key: 'acknowledged' },
  { key: 'overdue', isWarning: true },
  { key: 'done' },
];

// E4-07: the sidebar's "YOUR DEFAULT TAB" label now reflects the operator's
// real default category (resolved server-side via MenuCategory.defaultOperatorId
// and surfaced by useOperatorCategories.defaultCategoryId). The E4-03 mock
// in useOperatorStats is no longer consumed here.
type Props = {
  categories: OperatorCategory[];
  defaultCategoryId: string | null;
  categoriesLoading: boolean;
};

export function ShiftSidebar({ categories, defaultCategoryId, categoriesLoading }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { stats } = useOperatorStats();

  const defaultCategory = defaultCategoryId
    ? categories.find((c) => c.id === defaultCategoryId)
    : null;
  const defaultTabLabel = defaultCategory
    ? pickByLang(
        { en: defaultCategory.nameEn, tc: defaultCategory.nameTc, sc: defaultCategory.nameSc },
        language,
        defaultCategory.nameEn,
      )
    : categoriesLoading
      ? t('queue.loadingCount')
      : '—';

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-background">
      <div className="border-b border-border p-5">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-foreground-subtle">
          {t('sidebar.thisShift')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {KPI_ITEMS.map(({ key, isWarning }) => {
            const value = stats[key];
            const isOverdue = Boolean(isWarning) && value > 0;
            return (
              <div
                key={key}
                className={cn(
                  'rounded-md border p-3 transition-colors',
                  isOverdue
                    ? 'border-warning/40 bg-warning/10'
                    : 'border-border bg-background-elevated',
                )}
              >
                <div
                  className={cn(
                    'font-serif text-2xl tabular-nums',
                    isOverdue ? 'text-warning' : 'text-foreground',
                  )}
                >
                  {value}
                </div>
                <div
                  className={cn(
                    'mt-1 text-[10px] uppercase tracking-widest',
                    isOverdue ? 'text-warning' : 'text-foreground-subtle',
                  )}
                >
                  {t(`sidebar.kpi.${key}`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-b border-border p-5">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground-subtle">
          {t('sidebar.yourDefaultTab')}
        </div>
        <div className="font-medium text-foreground">{defaultTabLabel}</div>
        <p className="mt-2 text-xs leading-relaxed text-foreground-subtle">
          {t('sidebar.defaultTabHint')}
        </p>
      </div>

      <div className="flex-1" />

      <div className="border-t border-border p-5">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground-subtle">
          {t('sidebar.alertTimeout')}
        </div>
        <div className="font-serif text-xl text-foreground">60s</div>
        <p className="mt-2 text-xs leading-relaxed text-foreground-subtle">
          {t('sidebar.alertTimeoutHint')}
        </p>
      </div>
    </aside>
  );
}
