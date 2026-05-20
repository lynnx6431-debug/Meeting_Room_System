import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Minus, Plus } from 'lucide-react';
import { useUpdateHeadcount } from '../../hooks/useUpdateHeadcount';
import { useToast } from '../Toast';
import { cn } from '../../lib/utils';

const MIN = 1;
const MAX = 50;
const DEBOUNCE_MS = 500;

// Embedded − [n] + stepper (design page 4). Optimistic + debounced PATCH
// with rollback. The value useEffect also lets E4-07 SSE pushes sync an
// externally-changed headcount without extra wiring.
export function HeadcountStepper({
  value,
  sessionId,
  disabled = false,
}: {
  value: number | null;
  sessionId: string | null;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { show } = useToast();
  const { mutate } = useUpdateHeadcount();
  const [local, setLocal] = useState<number>(value ?? 0);
  const [saving, setSaving] = useState(false);
  const timer = useRef<number | null>(null);
  // Last server-confirmed value. E4-06 has no refetch/SSE yet, so the `value`
  // prop stays at first load; tracking confirmations here makes rollback land
  // on the truly-persisted number instead of a stale prop. E4-07 SSE will
  // refresh `value` and the effect below keeps this in sync.
  const confirmed = useRef<number>(value ?? 0);

  useEffect(() => {
    if (value != null) {
      confirmed.current = value;
      setLocal(value);
    }
  }, [value]);

  // Debounced persist: rapid +/+/+ collapses into one request; rollback on fail.
  useEffect(() => {
    if (value == null || sessionId == null) return;
    if (local === confirmed.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const target = local;
      setSaving(true);
      mutate(sessionId, target)
        .then(() => {
          confirmed.current = target; // persisted — new known-good baseline
        })
        .catch(() => {
          setLocal(confirmed.current); // rollback to last confirmed
          show(t('headcount.updateFailed'), 'error');
        })
        .finally(() => setSaving(false));
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [local, value, sessionId, mutate, show, t]);

  const interactive = !disabled && value != null && sessionId != null;
  const shown = value == null ? '—' : local;

  const btn =
    'flex h-6 w-6 items-center justify-center rounded-full border border-border text-foreground-muted transition-colors enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-sm',
        !interactive && 'opacity-60',
      )}
      aria-label="headcount"
    >
      <button
        type="button"
        className={btn}
        onClick={() => setLocal((n) => Math.max(MIN, n - 1))}
        disabled={!interactive || saving || local <= MIN}
        aria-label="decrease headcount"
      >
        <Minus size={12} />
      </button>
      <span className="min-w-[2ch] text-center tabular-nums text-foreground">{shown}</span>
      <button
        type="button"
        className={btn}
        onClick={() => setLocal((n) => Math.min(MAX, n + 1))}
        disabled={!interactive || saving || local >= MAX}
        aria-label="increase headcount"
      >
        <Plus size={12} />
      </button>
    </div>
  );
}
