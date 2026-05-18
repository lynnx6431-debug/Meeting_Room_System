import { useState } from 'react';

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
 * E4-03: returns MOCK data so the sidebar visuals can be built/reviewed.
 *
 * E4-05 REPLACE PATH: swap the hardcoded useState values below for
 *   fetch('/api/operator/stats') + polling, and resolve defaultTab from
 *   the user's linked MenuCategory.defaultOperatorId. The component API
 *   ({ stats, defaultTab, loading }) stays identical so ShiftSidebar
 *   does not change.
 */
export function useOperatorStats(): {
  stats: OperatorStats;
  defaultTab: DefaultTab | null;
  loading: boolean;
} {
  // TODO E4-05: replace with real API call + polling.
  const [stats] = useState<OperatorStats>({
    pending: 3,
    acknowledged: 1,
    overdue: 1,
    done: 3,
  });

  const [defaultTab] = useState<DefaultTab | null>({
    id: 'mock-drinks-id',
    nameEn: 'Drinks',
    nameTc: '飲品',
    nameSc: '饮品',
  });

  return { stats, defaultTab, loading: false };
}
