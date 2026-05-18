// OVERDUE is not a stored status (the backend has no timer and the
// OrderStatus enum is only pending|acknowledged|done). It is derived on the
// client: a still-pending order older than the alert threshold is overdue.
// E4-08 will reuse this for the 60s flashing behaviour.
export const OVERDUE_THRESHOLD_MS = 60_000;

export type RawStatus = 'pending' | 'acknowledged' | 'done';
export type DerivedStatus = 'pending' | 'acknowledged' | 'done' | 'overdue';

export function isOverdue(order: { status: RawStatus; createdAt: string }, now = Date.now()): boolean {
  return (
    order.status === 'pending' &&
    now - new Date(order.createdAt).getTime() > OVERDUE_THRESHOLD_MS
  );
}

export function derivedStatus(
  order: { status: RawStatus; createdAt: string },
  now = Date.now(),
): DerivedStatus {
  return isOverdue(order, now) ? 'overdue' : order.status;
}
