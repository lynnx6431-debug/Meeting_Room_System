import { Loader2, Wifi, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GuestApiError, guestFetch } from '../api/client';
import { useBranding } from '../context/BrandingContext';

type WifiQrData = {
  ssid: string;
  dataUrl: string;
};

type WifiQrOverlayProps = {
  open: boolean;
  onClose: () => void;
};

export function WifiQrOverlay({ open, onClose }: WifiQrOverlayProps) {
  const { t } = useTranslation();
  const branding = useBranding();
  const [qrData, setQrData] = useState<WifiQrData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setQrData(null);

    guestFetch<WifiQrData>('/wifi-qr', {}, branding.token)
      .then((data) => {
        if (!cancelled) {
          setQrData(data);
        }
      })
      .catch((caughtError) => {
        if (!cancelled) {
          const code = caughtError instanceof GuestApiError ? caughtError.code : 'NETWORK';
          setError(code);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [branding.token, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative mx-4 w-full max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-foreground/40 transition-colors hover:text-foreground"
          aria-label={t('wifi.close')}
        >
          <X size={24} />
        </button>

        <div className="mb-2 flex items-center justify-center gap-2 text-primary">
          <Wifi size={20} />
          <span className="text-sm font-medium uppercase tracking-[0.28em]">{t('wifi.title')}</span>
        </div>

        <h2 className="mb-2 font-serif text-3xl italic text-foreground/90">{t('wifi.scanToConnect')}</h2>
        <p className="mb-6 text-sm text-foreground/60">{t('wifi.helpText')}</p>

        {loading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : null}

        {error ? (
          <div className="flex h-72 flex-col items-center justify-center text-red-700">
            <p className="mb-2">{t('wifi.error')}</p>
            <p className="text-xs text-foreground/40">{error}</p>
          </div>
        ) : null}

        {qrData ? (
          <>
            <div className="mb-4 inline-block rounded-2xl border border-foreground/10 bg-white p-4">
              <img src={qrData.dataUrl} alt="WiFi QR code" className="h-64 w-64" />
            </div>

            <div className="space-y-1">
              <div className="text-xs uppercase tracking-[0.28em] text-foreground/50">{t('wifi.network')}</div>
              <div className="text-lg font-medium text-foreground/90">{qrData.ssid}</div>
            </div>
          </>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-full bg-foreground/10 px-6 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-foreground/15"
        >
          {t('wifi.close')}
        </button>
      </div>
    </div>
  );
}
