import type { OperatorOrder } from '../hooks/useOperatorOrders';

// Mirror of the server's Option C check (routes/operator.js isOrderVisible).
// Pure function so the SSE/Socket.IO push handler can re-run the same rule
// the GET /orders endpoint already applied — avoids relying on the server
// to do tenant fanout for category visibility.
export type OperatorMeta = {
  allowedRoomIds: string[];
  allowedCategoryIds: string[];
};

export function isOrderVisible(order: OperatorOrder, meta: OperatorMeta): boolean {
  if (!meta.allowedRoomIds.includes(order.room.id)) return false;
  const allowed = new Set(meta.allowedCategoryIds);
  return order.items.some((it) => it.categoryId && allowed.has(it.categoryId));
}

// Decide what to do with an incoming socket event when the user is on a
// specific tab (categoryId or 'all'). Pure, testable.
export type TabDisposition = 'append' | 'patch' | 'drop';

export function dispositionForTab(
  order: OperatorOrder,
  meta: OperatorMeta,
  activeTabId: string,
  alreadyInList: boolean,
): TabDisposition {
  if (!isOrderVisible(order, meta)) return alreadyInList ? 'patch' : 'drop';
  if (activeTabId === 'all') return alreadyInList ? 'patch' : 'append';
  // Tab focus: only items of the active category keep the order in this view.
  const inTab = order.items.some((it) => it.categoryId === activeTabId);
  if (!inTab) return alreadyInList ? 'patch' : 'drop';
  return alreadyInList ? 'patch' : 'append';
}
