import { useEffect, useMemo, useState } from 'react';

export function useRoomToken(): string | null {
  const initialToken = useMemo(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const params = new URLSearchParams(window.location.search);
    const value = params.get('token');
    return value?.trim() || null;
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
