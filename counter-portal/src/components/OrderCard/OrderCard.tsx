import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import type { OperatorCategory } from '../../hooks/useOperatorCategories';
import type { OperatorOrder } from '../../hooks/useOperatorOrders';
import { useOrderTransition } from '../../hooks/useOrderTransition';
import { derivedStatus } from '../../lib/orderStatus';
import { cn } from '../../lib/utils';
import { useToast } from '../Toast';
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

// E4-07: real ack/complete. We deliberately don't update local state on
// success — the server emits ticket_updated, which flows through the
// reducer and refreshes the order list. Same code path drives the
// operator's own click and a peer counter's click.
function ActionButton({ order }: { order: OperatorOrder }) {
  const { t } = useTranslation();
  const { show } = useToast();
  const { acknowledge, complete } = useOrderTransition();
  const [pending, setPending] = useState(false);

  const run = async (kind: 'ack' | 'complete') => {
    setPending(true);
    try {
      if (kind === 'ack') await acknowledge(order.id);
      else await complete(order.id);
      // Don't touch local state — wait for the Socket.IO push to update.
    } catch (_err) {
      show(t(kind === 'ack' ? 'counter.ackFailed' : 'counter.completeFailed'), 'error');
    } finally {
      setPending(false);
    }
  };

  if (order.status === 'pending') {
    return (
      <button
        type="button"
        onClick={() => run('ack')}
        disabled={pending}
        className="rounded-md bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
      >
        {t('order.acknowledge')}
      </button>
    );
  }
  if (order.status === 'acknowledged') {
    return (
      <button
        type="button"
        onClick={() => run('complete')}
        disabled={pending}
        className="rounded-md bg-success px-6 py-3 text-sm font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-95 disabled:cursor-wait disabled:opacity-60"
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
