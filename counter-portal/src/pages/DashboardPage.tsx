import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryTabBar } from '../components/CategoryTabBar';
import { DashboardHeader } from '../components/DashboardHeader';
import { ShiftSidebar } from '../components/ShiftSidebar';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();
  const clock = useClock();

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
          <CategoryTabBar />

          <main className="flex-1 overflow-y-auto p-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="font-serif text-3xl">{t('queue.title')}</h2>
                <p className="mt-1 text-sm text-foreground-muted">
                  {t('queue.subtitle')} ·{' '}
                  <span className="text-foreground">{t('queue.active', { count: 0 })}</span>
                </p>
              </div>
              <div className="text-sm tabular-nums text-foreground-muted">{clock}</div>
            </div>

            <div className="flex flex-col items-center justify-center py-20 text-foreground-subtle">
              <p className="text-sm">{t('queue.placeholder')}</p>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
