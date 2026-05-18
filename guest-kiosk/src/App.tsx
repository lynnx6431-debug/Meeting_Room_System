import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DevTokenHelper } from './components/DevTokenHelper';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrandingProvider } from './context/BrandingContext';
import { LanguageProvider } from './context/LanguageContext';
import { SessionProvider } from './context/SessionContext';
import { useRoomToken } from './hooks/useRoomToken';
import './i18n';
import { MenuPage } from './pages/MenuPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrderConfirmationPage } from './pages/OrderConfirmationPage';
import { WelcomePage } from './pages/WelcomePage';

export default function App() {
  const token = useRoomToken();

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-8 text-center text-foreground">
        <div className="max-w-xl space-y-3">
          <h1 className="text-2xl font-semibold">No room link detected</h1>
          <p className="text-foreground/60">
            Please scan the QR code in your suite or contact reception.
          </p>
          {import.meta.env.DEV ? <DevTokenHelper /> : null}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <BrandingProvider token={token}>
          <SessionProvider token={token}>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <Routes>
                <Route path="/" element={<WelcomePage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
                <Route path="/home" element={<Navigate to="/" replace />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </BrowserRouter>
          </SessionProvider>
        </BrandingProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}
