import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryTabBar } from '../components/CategoryTabBar';
import { DashboardHeader } from '../components/DashboardHeader';
import { OrderQueue } from '../components/OrderQueue';
import { ShiftSidebar } from '../components/ShiftSidebar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOperatorCategories } from '../hooks/useOperatorCategories';
import { useOperatorOrders, type OperatorOrder } from '../hooks/useOperatorOrders';
import { useOperatorSocket } from '../hooks/useOperatorSocket';
import { pickByLang } from '../lib/pickByLang';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now.toLocaleTimeString('en-GB');
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const clock = useClock();

  // Lifted so the queue + Socket.IO push handler all share the same filter.
  const [activeTabId, setActiveTabId] = useState<string>('all');
  const { categories, defaultCategoryId, loading } = useOperatorCategories();
  const {
    orders,
    meta,
    loading: ordersLoading,
    dispatch,
  } = useOperatorOrders({
    categoryId: activeTabId === 'all' ? undefined : activeTabId,
  });

  // Mutable ref so the socket handler can read the latest list without
  // resubscribing on every render.
  const ordersRef = useRef<OperatorOrder[]>(orders);
  ordersRef.current = orders;

  // Live updates. Returns connection state for the header's Live socket dot.
  const { connected: socketConnected } = useOperatorSocket({
    meta,
    activeTabId,
    ordersRef,
    dispatch,
  });

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const activeTitle = useMemo(() => {
    if (activeTabId === 'all') {
      return t('queue.allTickets');
    }
    const cat = categories.find((c) => c.id === activeTabId);
    return cat
      ? pickByLang({ en: cat.nameEn, tc: cat.nameTc, sc: cat.nameSc }, language, cat.nameEn)
      : t('queue.allTickets');
  }, [activeTabId, categories, language, t]);

  // ProtectedRoute guarantees a token; user is persisted alongside it.
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <DashboardHeader socketConnected={socketConnected} />

      <div className="flex flex-1 overflow-hidden">
        <ShiftSidebar
          categories={categories}
          defaultCategoryId={defaultCategoryId}
          categoriesLoading={loading}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <CategoryTabBar
            categories={categories}
            defaultCategoryId={defaultCategoryId}
            loading={loading}
            activeTabId={activeTabId}
            onSelect={setActiveTabId}
          />

          <main className="flex-1 overflow-y-auto p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-3xl">{activeTitle}</h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t('queue.subtitle')} ·{' '}
                  <span className="text-foreground">
                    {ordersLoading
                      ? t('queue.loadingCount')
                      : t('queue.active', { count: orders.length })}
                  </span>
                </p>
              </div>
              <div className="text-sm tabular-nums text-foreground-muted">{clock}</div>
            </div>

            <OrderQueue orders={orders} categoryMap={categoryMap} loading={ordersLoading} />
          </main>
        </div>
      </div>
    </div>
  );
}
