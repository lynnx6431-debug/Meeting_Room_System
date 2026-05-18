import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DEV-ONLY test helper (TEMPORARY). Renders a small floating button that resets
// the current room's active session (occupied -> vacant) via /api/dev/
// reset-session, then reloads to "/" so you can run the full flow again:
// pick headcount -> enter room -> order items.
//
// Never shipped to production: only mounts when import.meta.env.DEV is true,
// and the backend endpoint 404s when NODE_ENV === 'production'.
// To remove: delete this file and its <DevResetButton /> usage in App.tsx.
// ─────────────────────────────────────────────────────────────────────────────
export function DevResetButton({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!import.meta.env.DEV) {
    return null;
  }

  const handleReset = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/dev/reset-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Session is vacant again — go back to the welcome/headcount step.
      window.location.assign('/');
    } catch (err) {
      setBusy(false);
      setMsg(err instanceof Error ? err.message : 'Reset failed');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1">
      {msg ? (
        <span className="rounded bg-red-600 px-2 py-1 text-[10px] text-white shadow">
          {msg}
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleReset}
        disabled={busy}
        title="DEV ONLY: reset this room's session and restart the full flow"
        className="rounded-full border border-amber-400 bg-amber-300/95 px-4 py-2 text-xs font-semibold text-amber-950 shadow-lg transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Resetting…' : '⟲ Reset room (dev)'}
      </button>
    </div>
  );
}
