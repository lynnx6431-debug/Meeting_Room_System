import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { OperatorCategory } from '../../hooks/useOperatorCategories';
import type { OperatorOrder } from '../../hooks/useOperatorOrders';
import { derivedStatus } from '../../lib/orderStatus';
import { cn } from '../../lib/utils';
import { ElapsedTime } from './ElapsedTime';
import { HeadcountStepper } from './HeadcountStepper';
import { ItemChip } from './ItemChip';

function roomName(
  room: OperatorOrder['room'],
  lang: 'en' | 'tc' | 'sc',
): string {
  const map = { en: room.nameEn, tc: room.nameTc, sc: room.nameSc };
  return map[lang] || room.nameEn || room.name || room.code || '—';
}

// E4-06: pure UI. Action clicks are console.log placeholders; E4-07 wires
// the real PATCH acknowledge/complete. OVERDUE colour/flash is E4-08 — we
// only expose data-status + pass `overdue` so that work has a seam.
function ActionButton({ order }: { order: OperatorOrder }) {
  const { t } = useTranslation();
  const onClick = () => {
    // eslint-disable-next-line no-console
    console.log('[E4-06 placeholder] action on order', order.id, 'status', order.status);
  };

  if (order.status === 'pending') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-md bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-95"
      >
        {t('order.acknowledge')}
      </button>
    );
  }
  if (order.status === 'acknowledged') {
    return (
      <button
        type="button"
        onClick={onClick}
        className="rounded-md bg-success px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-95"
      >
        {t('order.markComplete')}
      </button>
    );
  }
  return null; // done → no action
}

export function OrderCard({
  order,
  categoryMap,
}: {
  order: OperatorOrder;
  categoryMap: Map<string, OperatorCategory>;
}) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const status = derivedStatus(order);
  const isDone = order.status === 'done';

  return (
    <div
      data-status={status}
      className={cn(
        'rounded-lg border border-border bg-background-elevated p-5',
        isDone && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-foreground-subtle">
            #{order.id.slice(0, 8)}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h3 className="font-serif text-2xl text-foreground">
              {roomName(order.room, language)}
            </h3>
            <span className="text-[10px] uppercase tracking-widest text-foreground-subtle">
              {t('headcount.label')}
            </span>
            <HeadcountStepper
              value={order.headcount}
              sessionId={order.sessionId}
              disabled={isDone}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {order.items.map((item, idx) => (
              <ItemChip
                key={`${item.itemId}-${idx}`}
                item={item}
                category={item.categoryId ? categoryMap.get(item.categoryId) : undefined}
              />
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <ElapsedTime createdAt={order.createdAt} overdue={status === 'overdue'} />
          <ActionButton order={order} />
        </div>
      </div>
    </div>
  );
}
