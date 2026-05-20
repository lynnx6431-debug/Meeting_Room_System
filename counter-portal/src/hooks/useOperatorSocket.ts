import { useEffect, useRef, useState, type Dispatch } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import {
  dispositionForTab,
  isOrderVisible,
  type OperatorMeta,
} from '../lib/orderVisibility';
import type { OperatorOrder } from './useOperatorOrders';
import type { OrdersAction } from './useOperatorOrders';

// E4-07: Socket.IO live updates. Reuses the backend's existing io.use() JWT
// handshake middleware — token goes in the auth payload (NOT in the URL),
// so it never lands in server logs.
//
// new_ticket / ticket_updated arrive tenant-scoped (server-side io.to() room
// fanout, see src/index.js); we still re-check Option C client-side because
// the active tab may exclude orders that ARE in the operator's allow set.
export function useOperatorSocket({
  meta,
  activeTabId,
  ordersRef,
  dispatch,
}: {
  meta: OperatorMeta;
  activeTabId: string;
  // Latest orders kept in a ref so the socket handler reads it fresh without
  // resubscribing on every list change.
  ordersRef: React.MutableRefObject<OperatorOrder[]>;
  dispatch: Dispatch<OrdersAction>;
}): { connected: boolean } {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  // Latest meta / activeTabId via ref so the socket subscription doesn't tear
  // down on tab switches.
  const metaRef = useRef(meta);
  metaRef.current = meta;
  const activeTabRef = useRef(activeTabId);
  activeTabRef.current = activeTabId;

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io({
      auth: { token },
      // Reuse the dev proxy at /socket.io (see vite.config.ts). In prod the
      // app and the API live on the same origin, so the default also works.
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] connect_error:', err.message);
      setConnected(false);
    };

    const handleIncoming = (event: 'new_ticket' | 'ticket_updated', order: OperatorOrder) => {
      const m = metaRef.current;
      const tab = activeTabRef.current;
      const alreadyInList = ordersRef.current.some((o) => o.id === order.id);
      const disp = dispositionForTab(order, m, tab, alreadyInList);
      if (disp === 'append') dispatch({ type: 'APPEND_ORDER', order });
      else if (disp === 'patch') dispatch({ type: 'PATCH_ORDER', order });
      else if (disp === 'drop') {
        // If it was in the list and now shouldn't be (e.g. moved to done in
        // an active-only view), remove it.
        if (alreadyInList && !isOrderVisible(order, m)) {
          dispatch({ type: 'REMOVE_ORDER', id: order.id });
        }
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('new_ticket', (order: OperatorOrder) => handleIncoming('new_ticket', order));
    socket.on('ticket_updated', (order: OperatorOrder) =>
      handleIncoming('ticket_updated', order),
    );

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('new_ticket');
      socket.off('ticket_updated');
      socket.disconnect();
    };
    // Only resubscribe when the auth token changes; tab/meta changes flow
    // through refs.
  }, [token, dispatch, ordersRef]);

  return { connected };
}
