import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';
import { LanguageToggle } from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';

export function DashboardPage() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  // ProtectedRoute guarantees a token; user is persisted alongside it.
  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-serif text-lg font-bold text-primary-foreground">
            M
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-foreground-muted">
              Manulife · Counter View
            </div>
            <div className="text-sm font-medium">{user.username}</div>
          </div>
        </div>
        <LanguageToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-8">
        <div className="w-full max-w-lg rounded-xl border border-border bg-background-elevated p-8 text-center">
          <h1 className="mb-6 font-serif text-2xl">{t('dashboard.placeholder')}</h1>
          <p className="mb-1 text-foreground-muted">
            {t('dashboard.loggedInAs')} <strong className="text-foreground">{user.username}</strong>
          </p>
          <p className="mb-8 text-foreground-muted">
            {t('dashboard.role')}: <span className="text-accent">{user.role}</span>
          </p>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-2 text-sm text-warning transition-colors hover:bg-warning/20"
          >
            <LogOut size={16} />
            {t('dashboard.logout')}
          </button>
        </div>
      </div>
    </div>
  );
}
