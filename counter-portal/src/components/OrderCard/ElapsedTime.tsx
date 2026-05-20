import { useTranslation } from 'react-i18next';
import { useElapsedSeconds } from '../../hooks/useElapsedSeconds';
import { splitElapsed } from '../../lib/orderTime';

// Live 1Hz elapsed time. `overdue` is accepted now so E4-08 can colour /
// flash it without touching this component's structure; E4-06 stays neutral.
export function ElapsedTime({
  createdAt,
  overdue = false,
}: {
  createdAt: string;
  overdue?: boolean;
}) {
  const { t } = useTranslation();
  const total = useElapsedSeconds(createdAt);
  const { m, s } = splitElapsed(total);

  const label = m > 0 ? t('order.elapsedMinutes', { m, s }) : t('order.elapsedSeconds', { count: s });

  return (
    <div className="text-right" data-overdue={overdue}>
      <div className="font-serif text-2xl tabular-nums text-foreground">{label}</div>
      <div className="text-[10px] uppercase tracking-widest text-foreground-subtle">
        {t('order.elapsed')}
      </div>
    </div>
  );
}
