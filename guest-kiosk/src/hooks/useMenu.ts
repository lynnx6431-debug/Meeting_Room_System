import { useEffect, useState } from 'react';
import { guestFetch, GuestApiError } from '../api/client';

export type MenuItem = {
  id: string;
  key: string;
  nameEn: string | null;
  nameTc: string | null;
  nameSc: string | null;
  descEn: string | null;
  descTc: string | null;
  descSc: string | null;
  imageUrl: string | null;
};

export type MenuCategory = {
  id: string;
  key: string;
  nameEn: string;
  nameTc: string | null;
  nameSc: string | null;
  orderMode: 'quantity' | 'one_off';
  limitMode: 'total_per_category' | 'per_item';
  sortOrder: number;
  imageUrl: string | null;
  items: MenuItem[];
};

export function useMenu(token: string) {
  const [categories, setCategories] = useState<MenuCategory[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);

    guestFetch<{ categories: MenuCategory[] }>('/menu', {}, token)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setCategories(data.categories);
        setError(null);
      })
      .catch((err: GuestApiError | Error) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof GuestApiError ? err.code : 'NETWORK');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { categories, loading, error };
}
