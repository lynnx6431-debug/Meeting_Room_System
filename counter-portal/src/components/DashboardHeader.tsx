import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { LanguageToggle } from './LanguageToggle';

// `socketConnected` reflects the Socket.IO connection state. Green pulsing
// dot when live; red + "Reconnecting…" while disconnected.
export function DashboardHeader({ socketConnected = false }: { socketConnected?: boolean }) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary font-serif text-lg font-bold text-primary-foreground">
            M
          </div>
          <span className="text-sm font-medium uppercase tracking-widest">MANULIFE</span>
        </div>

        <div className="h-8 w-px bg-border" />

        <div>
          <div className="text-xs uppercase tracking-widest text-foreground-muted">
            {t('header.counterView')}
          </div>
          <div className="mt-0.5 text-sm text-foreground">{t('header.counterLabel')}</div>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <LanguageToggle />

        <div
          className={cn(
            'flex items-center gap-2 rounded-full border px-3 py-1.5',
            socketConnected
              ? 'border-border bg-background-elevated'
              : 'border-warning/30 bg-warning/10',
          )}
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full opacity-60',
                socketConnected ? 'animate-ping bg-success' : 'bg-warning',
              )}
            />
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                socketConnected ? 'bg-success' : 'bg-warning',
              )}
            />
          </span>
          <span
            className={cn('text-xs', socketConnected ? 'text-foreground-muted' : 'text-warning')}
          >
            {socketConnected ? t('header.liveSocket') : t('counter.socketReconnecting')}
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-3 rounded-lg px-3 py-1.5 transition-colors hover:bg-background-elevated"
          title={t('header.logout')}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background-elevated text-xs font-medium text-foreground-muted">
            {initials}
          </div>
          <div className="text-left">
            <div className="text-sm text-foreground">{user.username}</div>
            <div className="text-xs text-foreground-subtle">{t(`role.${user.role}`)}</div>
          </div>
        </button>
      </div>
    </header>
  );
}
