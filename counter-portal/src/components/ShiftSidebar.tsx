import { useTranslation } from 'react-i18next';

const KPI_LABELS = ['PENDING', 'ACKNOWLEDGED', 'OVERDUE', 'DONE'] as const;

export function ShiftSidebar() {
  const { t } = useTranslation();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-background">
      <div className="border-b border-border p-5">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-foreground-subtle">
          {t('sidebar.thisShift')}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {KPI_LABELS.map((label) => (
            <div
              key={label}
              className="rounded-md border border-border bg-background-elevated p-3"
            >
              <div className="font-serif text-2xl text-foreground-subtle">—</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-foreground-subtle">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-b border-border p-5">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-foreground-subtle">
          {t('sidebar.yourDefaultTab')}
        </div>
        <div className="font-medium text-foreground">—</div>
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
