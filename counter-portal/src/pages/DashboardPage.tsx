import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryTabBar } from '../components/CategoryTabBar';
import { DashboardHeader } from '../components/DashboardHeader';
import { ShiftSidebar } from '../components/ShiftSidebar';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOperatorCategories } from '../hooks/useOperatorCategories';
import { useOperatorOrders } from '../hooks/useOperatorOrders';
import { derivedStatus } from '../lib/orderStatus';
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

  // Lifted here so the queue (E4-06) can share the same active-tab filter.
  const [activeTabId, setActiveTabId] = useState<string>('all');
  const { categories, defaultCategoryId, loading } = useOperatorCategories();
  const { orders, loading: ordersLoading } = useOperatorOrders({
    categoryId: activeTabId === 'all' ? undefined : activeTabId,
  });

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
      <DashboardHeader />

      <div className="flex flex-1 overflow-hidden">
        <ShiftSidebar />

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

            {/* TODO E4-06: replace this raw dump with order cards. This proves
                the RBAC-filtered data flow (room + Option C category) works. */}
            {ordersLoading ? (
              <div className="py-20 text-center text-sm text-foreground-subtle">
                {t('queue.loadingCount')}
              </div>
            ) : orders.length === 0 ? (
              <div className="py-20 text-center text-sm text-foreground-subtle">
                {t('queue.empty')}
              </div>
            ) : (
              <pre className="overflow-x-auto rounded-lg border border-border bg-background-elevated p-4 text-xs text-foreground-muted">
                {JSON.stringify(
                  orders.map((o) => ({
                    id: o.id.slice(0, 8),
                    status: derivedStatus(o),
                    room: o.room.code || o.room.name,
                    items: o.items.map((it) => `${it.name}×${it.qty}`),
                  })),
                  null,
                  2,
                )}
              </pre>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
