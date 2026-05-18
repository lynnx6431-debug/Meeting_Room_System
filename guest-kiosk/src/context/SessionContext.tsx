import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { GuestApiError, guestFetch } from '../api/client';
import type { GuestSession, GuestSessionResponse, SessionUsage } from '../api/types';

export type SessionData = {
  id: string;
  headcount: number;
  status: 'occupied' | 'vacant';
  createdAt: string;
  roomId: string;
  siteId: string;
};

type SessionContextValue = {
  session: SessionData | null;
  usage: SessionUsage[];
  loading: boolean;
  error: string | null;
  createSession: (headcount: number) => Promise<SessionData>;
  refetch: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children, token }: { children: ReactNode; token: string }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [usage, setUsage] = useState<SessionUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await guestFetch<GuestSessionResponse>('/session', {}, token);
      setSession(normalizeSession(data.session));
      setUsage(data.usage || []);
    } catch (fetchError) {
      setError(fetchError instanceof GuestApiError ? fetchError.code : 'NETWORK');
      setSession(null);
      setUsage([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  const createSession = useCallback(
    async (headcount: number): Promise<SessionData> => {
      const data = await guestFetch<GuestSession>(
        '/session',
        {
          method: 'POST',
          body: JSON.stringify({ headcount }),
        },
        token,
      );

      const normalized = normalizeSession(data);
      if (!normalized) {
        throw new Error('SESSION_CREATE_EMPTY');
      }

      setSession(normalized);
      setUsage([]);
      setError(null);
      return normalized;
    },
    [token],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      usage,
      loading,
      error,
      createSession,
      refetch: fetchSession,
    }),
    [createSession, error, fetchSession, loading, session, usage],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return ctx;
}

function normalizeSession(session: GuestSession | null): SessionData | null {
  if (!session) {
    return null;
  }

  return {
    id: session.id,
    headcount: session.headcount,
    status: session.status === 'occupied' ? 'occupied' : 'vacant',
    createdAt: session.createdAt,
    roomId: session.roomId,
    siteId: session.siteId,
  };
}
