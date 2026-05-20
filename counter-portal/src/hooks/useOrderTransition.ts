import { useCallback } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { OperatorOrder } from './useOperatorOrders';

// Thin wrappers over PATCH /api/operator/orders/:id/{acknowledge,complete}.
// The server emits `ticket_updated` on success — the UI does NOT update
// local state from the response. The Socket.IO push (via the reducer) is
// the single source of truth, so the same code path drives "own click"
// and "other operator's click".
export function useOrderTransition() {
  const { token } = useAuth();

  const acknowledge = useCallback(
    (orderId: string) =>
      apiFetch<{ order: OperatorOrder }>(
        `/operator/orders/${orderId}/acknowledge`,
        { method: 'PATCH' },
        token,
      ),
    [token],
  );

  const complete = useCallback(
    (orderId: string) =>
      apiFetch<{ order: OperatorOrder }>(
        `/operator/orders/${orderId}/complete`,
        { method: 'PATCH' },
        token,
      ),
    [token],
  );

  return { acknowledge, complete };
}
