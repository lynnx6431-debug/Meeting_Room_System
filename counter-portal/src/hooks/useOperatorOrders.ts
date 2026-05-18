import { useEffect, useState } from 'react';
import { CounterApiError, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { RawStatus } from '../lib/orderStatus';

export type OperatorOrderItem = {
  itemId: string;
  qty: number;
  name: string;
  categoryId: string | null;
  nameEn: string;
  nameTc: string;
  nameSc: string;
};

export type OperatorOrder = {
  id: string;
  status: RawStatus;
  createdAt: string;
  acknowledgedAt: string | null;
  completedAt: string | null;
  headcount: number | null;
  room: {
    id: string;
    code: string | null;
    name: string;
    nameEn: string | null;
    nameTc: string | null;
    nameSc: string | null;
  };
  items: OperatorOrderItem[];
};

type OrdersResponse = {
  orders: OperatorOrder[];
  total: number;
  meta: { allowedRoomIds: string[]; allowedCategoryIds: string[] };
};

export function useOperatorOrders(opts: { categoryId?: string; status?: string }): {
  orders: OperatorOrder[];
  loading: boolean;
  error: string | null;
} {
  const { token } = useAuth();
  const [orders, setOrders] = useState<OperatorOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { categoryId, status } = opts;

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (status) params.set('status', status);
    const qs = params.toString();

    apiFetch<OrdersResponse>(`/operator/orders${qs ? `?${qs}` : ''}`, {}, token)
      .then((data) => {
        if (!cancelled) setOrders(data.orders);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof CounterApiError ? e.code || 'NETWORK' : 'NETWORK');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, categoryId, status]);

  return { orders, loading, error };
}
