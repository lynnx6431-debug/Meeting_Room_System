import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-8 text-center">
      <div className="space-y-4">
        <div className="font-serif text-6xl text-foreground-subtle">404</div>
        <h1 className="text-xl font-medium text-foreground">{t('notFound.title')}</h1>
        <Link
          to="/dashboard"
          className="inline-block rounded-lg border border-border bg-background-elevated px-4 py-2 text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          {t('notFound.back')}
        </Link>
      </div>
    </div>
  );
}
