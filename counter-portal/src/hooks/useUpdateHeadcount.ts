import { useCallback } from 'react';
import { apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

type HeadcountResponse = { session: { id: string; headcount: number } };

// Thin wrapper over PATCH /api/operator/sessions/:id/headcount.
// Optimistic update + debounce + rollback live in HeadcountStepper.
export function useUpdateHeadcount() {
  const { token } = useAuth();

  const mutate = useCallback(
    (sessionId: string, headcount: number) =>
      apiFetch<HeadcountResponse>(
        `/operator/sessions/${sessionId}/headcount`,
        { method: 'PATCH', body: JSON.stringify({ headcount }) },
        token,
      ),
    [token],
  );

  return { mutate };
}
