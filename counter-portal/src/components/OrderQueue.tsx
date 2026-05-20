import { useTranslation } from 'react-i18next';
import type { OperatorCategory } from '../hooks/useOperatorCategories';
import type { OperatorOrder } from '../hooks/useOperatorOrders';
import { OrderCard } from './OrderCard/OrderCard';

export function OrderQueue({
  orders,
  categoryMap,
  loading,
}: {
  orders: OperatorOrder[];
  categoryMap: Map<string, OperatorCategory>;
  loading: boolean;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-foreground-subtle">
        {t('queue.loadingCount')}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="py-20 text-center text-sm text-foreground-subtle">{t('queue.empty')}</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} categoryMap={categoryMap} />
      ))}
    </div>
  );
}
