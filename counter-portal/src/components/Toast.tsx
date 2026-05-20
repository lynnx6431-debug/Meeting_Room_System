import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../lib/utils';

type ToastKind = 'error' | 'info';
type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Lightweight, dependency-free toast. Bottom-right stack, auto-dismiss 4s.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = ++seq.current;
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              'pointer-events-auto rounded-lg border px-4 py-2.5 text-sm shadow-lg',
              t.kind === 'error'
                ? 'border-warning/30 bg-warning/15 text-warning'
                : 'border-border bg-background-elevated text-foreground',
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
