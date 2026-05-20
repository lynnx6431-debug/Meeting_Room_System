import { useMemo } from 'react';
import { isOverdue } from '../lib/orderStatus';
import { useOperatorOrders } from './useOperatorOrders';

export type OperatorStats = {
  pending: number;
  acknowledged: number;
  overdue: number;
  done: number;
};

/**
 * KPI derived from the operator's visible orders (Option X — no extra
 * backend endpoint; n < 50, client-side counting is trivial). OVERDUE is
 * computed client-side because the backend has no such status.
 *
 * E4-07: the previous `defaultTab` mock has been removed — the sidebar
 * now reads `useOperatorCategories().defaultCategoryId` directly.
 */
export function useOperatorStats(): {
  stats: OperatorStats;
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

  return { stats, loading };
}
