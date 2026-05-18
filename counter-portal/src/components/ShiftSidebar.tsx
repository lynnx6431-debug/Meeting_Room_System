import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import { useOperatorStats, type OperatorStats } from '../hooks/useOperatorStats';
import { cn } from '../lib/utils';
import { pickByLang } from '../lib/pickByLang';

const KPI_ITEMS: { key: keyof OperatorStats; isWarning?: boolean }[] = [
  { key: 'pending' },
  { key: 'acknowledged' },
  { key: 'overdue', isWarning: true },
  { key: 'done' },
];

export function ShiftSidebar() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { stats, defaultTab } = useOperatorStats();

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
        <div className="font-medium text-foreground">
          {defaultTab
            ? pickByLang(
                { en: defaultTab.nameEn, tc: defaultTab.nameTc, sc: defaultTab.nameSc },
                language,
                defaultTab.nameEn,
              )
            : '—'}
        </div>
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
