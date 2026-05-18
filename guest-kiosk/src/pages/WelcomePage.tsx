import { ChevronRight, Loader2, Wifi } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GuestApiError } from '../api/client';
import { HeadcountPicker } from '../components/HeadcountPicker';
import { LanguageToggle } from '../components/LanguageToggle';
import { WifiQrOverlay } from '../components/WifiQrOverlay';
import { useBranding } from '../context/BrandingContext';
import { useLanguage, type Language } from '../context/LanguageContext';
import { useSession } from '../context/SessionContext';
import { pickByLang } from '../lib/pickByLang';

export function WelcomePage() {
  const { t } = useTranslation();
  const branding = useBranding();
  const { language } = useLanguage();
  const { session, loading: sessionLoading, createSession } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [now, setNow] = useState(() => new Date());
  const [headcount, setHeadcount] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [wifiOpen, setWifiOpen] = useState(false);
  const fromMenu = searchParams.get('from') === 'menu';

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (fromMenu) {
      return;
    }

    if (!sessionLoading && session && session.status === 'occupied') {
      navigate('/menu', { replace: true });
    }
  }, [fromMenu, navigate, session, sessionLoading]);

  const roomName = useMemo(
    () =>
      pickByLang(
        {
          en: branding.roomNameEn,
          tc: branding.roomNameTc,
          sc: branding.roomNameSc,
        },
        language,
        branding.roomName,
      ),
    [branding.roomName, branding.roomNameEn, branding.roomNameSc, branding.roomNameTc, language],
  );

  const welcomeMessage = useMemo(
    () =>
      pickByLang(
        {
          en: branding.welcomeEn,
          tc: branding.welcomeTc,
          sc: branding.welcomeSc,
        },
        language,
        t('welcome.subtitle'),
      ),
    [branding.welcomeEn, branding.welcomeSc, branding.welcomeTc, language, t],
  );

  const siteNameUpper = branding.siteName.toUpperCase();
  const servedBy = branding.siteName.split(' ')[0] || branding.siteName;

  const handleConfirm = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      await createSession(headcount);
      navigate('/menu');
    } catch (error) {
      const code = error instanceof GuestApiError ? error.code : 'NETWORK';
      setSubmitError(code);
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7f3eb_0%,#fcfaf5_100%)] text-foreground">
        <div className="bg-primary px-6 py-2 text-xs text-primary-foreground">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between">
            <span className="tracking-wide text-primary-foreground/85">{formatNowLocale(now, language)}</span>
            <span className="flex items-center gap-3 text-primary-foreground/85">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              <span>Connected</span>
              <span>WiFi</span>
              <span>72%</span>
            </span>
          </div>
        </div>

        <header className="border-b border-white/10 bg-primary px-4 py-4 text-primary-foreground shadow-sm sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-lg font-semibold text-primary shadow-sm">
                M
              </div>
              <div className="h-7 w-px bg-white/25" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm sm:tracking-[0.24em]">
                {siteNameUpper}
              </span>
              <nav className="ml-6 hidden items-center gap-8 text-sm md:flex">
                <span className="text-primary-foreground">Home</span>
                <span className="text-primary-foreground/70">Menu</span>
                <span className="text-primary-foreground/70">Concierge</span>
              </nav>
            </div>
            <LanguageToggle />
          </div>
        </header>

        <div className="pointer-events-none absolute left-4 top-32 h-7 w-7 border-l-2 border-t-2 border-primary/70 sm:left-8 sm:top-36 sm:h-9 sm:w-9 lg:left-12" />
        <div className="pointer-events-none absolute right-4 top-32 h-7 w-7 border-r-2 border-t-2 border-primary/70 sm:right-8 sm:top-36 sm:h-9 sm:w-9 lg:right-12" />
        <div className="pointer-events-none absolute bottom-6 left-4 h-7 w-7 border-b-2 border-l-2 border-primary/70 sm:left-8 sm:h-9 sm:w-9 lg:left-12" />
        <div className="pointer-events-none absolute bottom-6 right-4 h-7 w-7 border-b-2 border-r-2 border-primary/70 sm:right-8 sm:h-9 sm:w-9 lg:right-12" />

        <main className="relative mx-auto flex min-h-[calc(100vh-97px)] w-full max-w-[1440px] flex-col items-center px-4 pb-24 pt-10 text-center sm:px-6 sm:pt-14 lg:px-8">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-4xl font-semibold text-primary-foreground shadow-[0_16px_30px_rgba(0,132,92,0.18)]">
            M
          </div>

          <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/80 sm:text-xs sm:tracking-[0.36em]">
            {siteNameUpper} PRESTIGE LOUNGE
          </div>

          <div className="flex max-w-5xl items-center justify-center gap-3 sm:gap-5">
            <span className="hidden h-px w-8 bg-primary/70 sm:block md:w-12" />
            <h1 className="font-serif text-3xl italic leading-tight text-foreground/90 sm:text-[2.8rem] lg:text-[3.6rem]">
              {t('welcome.title', { roomName })}
            </h1>
            <span className="hidden h-px w-8 bg-primary/70 sm:block md:w-12" />
          </div>

          <p className="mb-10 mt-4 max-w-2xl px-2 text-sm italic text-foreground/55 sm:text-lg">
            {welcomeMessage}
          </p>

          {fromMenu && session ? (
            <div className="mb-6 w-full max-w-md rounded-2xl bg-white p-7 shadow-lg">
              <div className="mb-3 text-center text-xs uppercase tracking-[0.28em] text-foreground/50">
                {t('welcome.sessionActive')}
              </div>
              <div className="mb-2 text-center font-serif text-2xl italic text-foreground/80">
                {t('welcome.partyOf', { count: session.headcount })}
              </div>
              <p className="mb-5 text-center text-xs text-foreground/40">{t('welcome.sessionResume')}</p>
              <button
                type="button"
                onClick={() => navigate('/menu')}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 font-medium tracking-wide text-primary-foreground hover:opacity-95"
              >
                {t('welcome.returnToMenu')}
                <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <div className="w-full max-w-[560px] rounded-[24px] border border-primary/8 bg-white px-6 py-7 shadow-[0_14px_32px_rgba(15,23,42,0.10)] sm:px-8">
              <div className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.28em] text-primary/80">
                {t('welcome.headcount')}
              </div>
              <HeadcountPicker value={headcount} onChange={setHeadcount} disabled={submitting || sessionLoading} />
              <p className="mb-6 mt-5 text-center text-xs text-foreground/45">{t('welcome.headcountHelp')}</p>
              {submitError ? (
                <div
                  className="animate-in fade-in duration-200 mb-3 text-center text-xs text-red-600"
                  role="alert"
                >
                  {t(`errors.${submitError}`, { defaultValue: submitError })}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={submitting || sessionLoading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold tracking-[0.12em] text-primary-foreground shadow-[0_10px_24px_rgba(0,132,92,0.25)] transition-opacity hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('welcome.submitting')}
                  </>
                ) : (
                  <>
                    {t('welcome.confirm')}
                    <ChevronRight size={16} />
                  </>
                )}
              </button>
            </div>
          )}

          {branding.wifiSsid ? (
            <button
              type="button"
              onClick={() => setWifiOpen(true)}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/90 px-5 py-2.5 text-sm font-medium text-foreground/70 shadow-sm transition-colors hover:bg-white"
            >
              <Wifi size={15} className="text-primary" />
              {t('welcome.wifi')}
            </button>
          ) : null}

          <div className="absolute bottom-8 left-0 right-0 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-foreground/30 sm:bottom-12 sm:text-xs sm:tracking-[0.26em]">
            Served by {servedBy}
          </div>
        </main>
      </div>
      <WifiQrOverlay open={wifiOpen} onClose={() => setWifiOpen(false)} />
    </>
  );
}

function formatNowLocale(now: Date, lang: Language): string {
  const locale = lang === 'sc' ? 'zh-CN' : lang === 'tc' ? 'zh-HK' : 'en-US';
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);

  return `${time} · ${date}`;
}
