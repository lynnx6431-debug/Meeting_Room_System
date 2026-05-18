import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { CounterApiError } from '../api/client';
import { LanguageToggle } from '../components/LanguageToggle';
import { useAuth } from '../context/AuthContext';

// Map the live backend's responses to localized error keys.
// Backend returns 401 { error: 'Invalid credentials' } (no machine code),
// so we normalize by HTTP status rather than trusting the message string.
function toErrorKey(err: unknown): string {
  if (err instanceof CounterApiError) {
    if (err.status === 401) return 'INVALID_CREDENTIALS';
    if (err.status === 0 || err.code === 'NETWORK') return 'NETWORK';
    return err.code || 'NETWORK';
  }
  return 'NETWORK';
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(toErrorKey(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex justify-end border-b border-border px-8 py-4">
        <LanguageToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary font-serif text-xl font-bold text-primary-foreground">
              M
            </div>
            <div>
              <div className="text-sm font-medium uppercase tracking-widest">MANULIFE</div>
              <div className="text-xs text-foreground-muted">Counter View</div>
            </div>
          </div>

          <h1 className="mb-2 text-center font-serif text-3xl text-foreground">
            {t('login.title')}
          </h1>
          <p className="mb-10 text-center text-sm text-foreground-muted">
            {t('login.subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="mb-2 block text-xs uppercase tracking-wider text-foreground-muted"
              >
                {t('login.username')}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={submitting}
                required
                autoFocus
                autoComplete="username"
                className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 text-foreground placeholder-foreground-subtle transition-colors focus:border-primary focus:outline-none"
                placeholder="operator-bev"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-xs uppercase tracking-wider text-foreground-muted"
              >
                {t('login.password')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-border bg-background-elevated px-4 py-3 text-foreground placeholder-foreground-subtle transition-colors focus:border-primary focus:outline-none"
                placeholder="••••••••"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning/10 px-4 py-2.5 text-sm text-warning"
              >
                <AlertCircle size={16} />
                <span>{t(`errors.${error}`, { defaultValue: error })}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !username || !password}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium tracking-wide text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  {t('login.submitting')}
                </>
              ) : (
                t('login.submit')
              )}
            </button>
          </form>

          <div className="mt-12 text-center text-xs text-foreground-subtle">
            {t('login.devHint', { defaultValue: 'Demo: operator-bev / demo123' })}
          </div>
        </div>
      </div>
    </div>
  );
}
