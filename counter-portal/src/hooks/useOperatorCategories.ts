import { useEffect, useState } from 'react';
import { CounterApiError, apiFetch } from '../api/client';
import { useAuth } from '../context/AuthContext';

export type OperatorCategory = {
  id: string;
  key: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
  orderMode: 'quantity' | 'one_off';
  limitMode: 'total_per_category' | 'per_item';
  sortOrder: number;
};

type CategoriesResponse = {
  categories: OperatorCategory[];
  defaultCategoryId: string | null;
};

export function useOperatorCategories(): {
  categories: OperatorCategory[];
  defaultCategoryId: string | null;
  loading: boolean;
  error: string | null;
} {
  const { token } = useAuth();
  const [categories, setCategories] = useState<OperatorCategory[]>([]);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }
    let cancelled = false;

    setLoading(true);
    setError(null);

    apiFetch<CategoriesResponse>('/operator/categories', {}, token)
      .then((data) => {
        if (cancelled) return;
        setCategories(data.categories);
        setDefaultCategoryId(data.defaultCategoryId);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof CounterApiError ? e.code || 'NETWORK' : 'NETWORK');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { categories, defaultCategoryId, loading, error };
}
