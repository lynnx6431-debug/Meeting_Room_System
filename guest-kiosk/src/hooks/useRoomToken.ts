import { useEffect, useMemo, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// DEV CONVENIENCE (TEMPORARY) — token persistence so a page refresh or opening
// /menu directly keeps the session alive.
//
// Original PRODUCTION behavior: the room token is read once from the ?token=
// query string, stripped from the URL, and kept ONLY in memory (never
// persisted). A refresh / direct deep-link therefore loses the session — which
// is correct for the real kiosk (always entered via QR) but painful for dev.
//
// To REVERT to production behavior: delete STORAGE_KEY + the localStorage
// read/write below and return to reading the URL param only (see git history
// of this file).
// ─────────────────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'guest-kiosk:dev-room-token';

export function useRoomToken(): string | null {
  const initialToken = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    // 1. Prefer an explicit ?token= in the URL (a fresh QR / dev link).
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('token')?.trim() || null;
    if (fromUrl) {
      try {
        window.localStorage.setItem(STORAGE_KEY, fromUrl);
      } catch {
        /* storage unavailable — fall back to in-memory only */
      }
      return fromUrl;
    }

    // 2. No token in URL (refresh or direct /menu): restore the last one.
    try {
      return window.localStorage.getItem(STORAGE_KEY)?.trim() || null;
    } catch {
      return null;
    }
  }, []);

  const [token] = useState<string | null>(initialToken);

  useEffect(() => {
    if (!token || typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) {
      return;
    }
    url.searchParams.delete('token');
    const nextUrl = `${url.pathname}${url.search}${url.hash}` || '/';
    window.history.replaceState({}, '', nextUrl);
  }, [token]);

  return token;
}
