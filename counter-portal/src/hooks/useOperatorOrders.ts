import { useEffect, useReducer, type Dispatch } from 'react';
import { CounterApiError, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { RawStatus } from '../lib/orderStatus';
import type { OperatorMeta } from '../lib/orderVisibility';

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
  sessionId: string | null;
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
  meta: OperatorMeta;
};

// ─── Reducer actions ─────────────────────────────────────────────────────
// FETCH_*  : http baseline on mount / param change
// APPEND_ORDER  : new_ticket / ticket_updated for an order not in the list
// PATCH_ORDER   : ticket_updated for an order already in the list
// REMOVE_ORDER  : explicit removal (e.g. order moved out of active filter)
export type OrdersAction =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; orders: OperatorOrder[]; meta: OperatorMeta }
  | { type: 'FETCH_ERROR'; error: string }
  | { type: 'APPEND_ORDER'; order: OperatorOrder }
  | { type: 'PATCH_ORDER'; order: OperatorOrder }
  | { type: 'REMOVE_ORDER'; id: string };

type OrdersState = {
  orders: OperatorOrder[];
  meta: OperatorMeta;
  loading: boolean;
  error: string | null;
};

const INITIAL: OrdersState = {
  orders: [],
  meta: { allowedRoomIds: [], allowedCategoryIds: [] },
  loading: true,
  error: null,
};

function reducer(state: OrdersState, action: OrdersAction): OrdersState {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS':
      return { ...state, orders: action.orders, meta: action.meta, loading: false, error: null };
    case 'FETCH_ERROR':
      return { ...state, loading: false, error: action.error };
    case 'APPEND_ORDER': {
      if (state.orders.some((o) => o.id === action.order.id)) {
        // De-dup if the same order also arrived via patch; treat as patch.
        return {
          ...state,
          orders: state.orders.map((o) => (o.id === action.order.id ? action.order : o)),
        };
      }
      return { ...state, orders: [action.order, ...state.orders] };
    }
    case 'PATCH_ORDER': {
      const idx = state.orders.findIndex((o) => o.id === action.order.id);
      if (idx === -1) return state; // not in list — caller decides via APPEND
      const next = state.orders.slice();
      next[idx] = action.order;
      return { ...state, orders: next };
    }
    case 'REMOVE_ORDER':
      return { ...state, orders: state.orders.filter((o) => o.id !== action.id) };
    default:
      return state;
  }
}

export function useOperatorOrders(opts: { categoryId?: string; status?: string }): {
  orders: OperatorOrder[];
  meta: OperatorMeta;
  loading: boolean;
  error: string | null;
  dispatch: Dispatch<OrdersAction>;
} {
  const { token } = useAuth();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const { categoryId, status } = opts;

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    dispatch({ type: 'FETCH_START' });

    const params = new URLSearchParams();
    if (categoryId) params.set('categoryId', categoryId);
    if (status) params.set('status', status);
    const qs = params.toString();

    apiFetch<OrdersResponse>(`/operator/orders${qs ? `?${qs}` : ''}`, {}, token)
      .then((data) => {
        if (cancelled) return;
        dispatch({ type: 'FETCH_SUCCESS', orders: data.orders, meta: data.meta });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        dispatch({
          type: 'FETCH_ERROR',
          error: e instanceof CounterApiError ? e.code || 'NETWORK' : 'NETWORK',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token, categoryId, status]);

  return { ...state, dispatch };
}
