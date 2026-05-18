import { CheckCircle, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { LanguageToggle } from '../components/LanguageToggle';

export function OrderConfirmationPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const orderId = (location.state as { orderId?: string } | null)?.orderId;

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex justify-end p-4 sm:p-6">
        <LanguageToggle variant="onLight" />
      </div>

      <div className="flex flex-1 items-center justify-center px-6 pb-8 sm:px-8">
        <div className="max-w-md text-center">
          <CheckCircle className="mx-auto mb-6 text-primary" size={64} />
          <h1 className="mb-3 font-serif text-3xl italic sm:text-4xl">{t('confirmation.title')}</h1>
          <p className="mb-2 text-foreground/60">{t('confirmation.subtitle')}</p>
          {orderId ? (
            <p className="mb-8 text-xs text-foreground/40">
              {t('confirmation.orderId')}: <code>{String(orderId).slice(0, 8)}...</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground hover:opacity-95"
          >
            {t('confirmation.orderMore')}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
