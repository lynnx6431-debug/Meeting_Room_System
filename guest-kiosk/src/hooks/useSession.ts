import { useCallback, useEffect, useState } from 'react';
import { guestFetch, GuestApiError } from '../api/client';
import type { GuestSessionResponse } from '../api/types';

export function useSession(token: string) {
  const [data, setData] = useState<GuestSessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<GuestApiError | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await guestFetch<GuestSessionResponse>('/session', {}, token);
      setData(response);
      setError(null);
    } catch (err) {
      setError(err as GuestApiError);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
