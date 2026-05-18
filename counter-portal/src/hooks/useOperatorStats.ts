import { useMemo } from 'react';
import { isOverdue } from '../lib/orderStatus';
import { useOperatorOrders } from './useOperatorOrders';

export type OperatorStats = {
  pending: number;
  acknowledged: number;
  overdue: number;
  done: number;
};

export type DefaultTab = {
  id: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
};

/**
 * E4-05: KPI now derived from REAL orders (Option X — no extra backend
 * endpoint; n < 50 so client-side counting is trivial). OVERDUE is computed
 * client-side (see lib/orderStatus) because the backend has no such status.
 *
 * defaultTab is still a placeholder string; the real default category is
 * already resolved server-side and consumed by the tab bar
 * (useOperatorCategories.defaultCategoryId). TODO: surface the localized
 * name here too if the sidebar ever needs it beyond the demo.
 */
export function useOperatorStats(): {
  stats: OperatorStats;
  defaultTab: DefaultTab | null;
  loading: boolean;
} {
  const { orders, loading } = useOperatorOrders({ status: 'all' });

  const stats = useMemo<OperatorStats>(() => {
    const now = Date.now();
    let pending = 0;
    let acknowledged = 0;
    let overdue = 0;
    let done = 0;
    for (const o of orders) {
      if (o.status === 'done') {
        done += 1;
      } else if (o.status === 'acknowledged') {
        acknowledged += 1;
      } else if (isOverdue(o, now)) {
        overdue += 1;
      } else {
        pending += 1;
      }
    }
    return { pending, acknowledged, overdue, done };
  }, [orders]);

  // TODO E4-xx: replace with the operator's real default category name if the
  // sidebar label must be exact beyond the demo (tab auto-select already uses
  // the real server-derived defaultCategoryId).
  const defaultTab: DefaultTab = {
    id: 'default',
    nameEn: 'Drinks',
    nameTc: '飲品',
    nameSc: '饮品',
  };

  return { stats, defaultTab, loading };
}
