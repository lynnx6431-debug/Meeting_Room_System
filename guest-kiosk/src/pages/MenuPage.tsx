import { GuestApiError, guestFetch } from '../api/client';
import { Loader2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CartPanel } from '../components/CartPanel';
import { CategorySidebar } from '../components/CategorySidebar';
import { LanguageToggle } from '../components/LanguageToggle';
import { MenuItemCard } from '../components/MenuItemCard';
import { useBranding } from '../context/BrandingContext';
import { useLanguage, type Language } from '../context/LanguageContext';
import type { MenuCategory, MenuItem } from '../hooks/useMenu';
import { useSession } from '../context/SessionContext';
import { useMenu } from '../hooks/useMenu';
import { canAdd, type CartItem, getItemState } from '../lib/cartCapacity';
import { pickByLang } from '../lib/pickByLang';

export function MenuPage() {
  const { t } = useTranslation();
  const branding = useBranding();
  const { session, usage: backendUsage, refetch } = useSession();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { categories, loading, error } = useMenu(branding.token);
  const [currentCategoryId, setCurrentCategoryId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [transientError, setTransientError] = useState<string | null>(null);
  const [transientErrorClosing, setTransientErrorClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const headcount = session?.headcount || 0;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!transientError) {
      return;
    }

    setTransientErrorClosing(false);

    const closeTimer = window.setTimeout(() => {
      setTransientErrorClosing(true);
    }, 2600);

    const clearTimer = window.setTimeout(() => {
      setTransientError(null);
      setTransientErrorClosing(false);
    }, 2900);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [transientError]);

  const effectiveCategoryId = useMemo(() => {
    if (currentCategoryId) {
      return currentCategoryId;
    }
    return categories?.[0]?.id || null;
  }, [categories, currentCategoryId]);

  const currentCategory = useMemo(
    () => categories?.find((category) => category.id === effectiveCategoryId) || null,
    [categories, effectiveCategoryId],
  );

  const totalUsage = useMemo(() => {
    const next: Record<string, number> = {};

    for (const usageItem of backendUsage) {
      next[usageItem.categoryId] = (next[usageItem.categoryId] || 0) + usageItem.quantityUsed;
    }

    for (const item of cart.values()) {
      next[item.categoryId] = (next[item.categoryId] || 0) + item.qty;
    }

    return next;
  }, [backendUsage, cart]);

  const allCategoriesFull = useMemo(() => {
    if (!categories || categories.length === 0 || headcount <= 0) {
      return false;
    }

    return categories.every((category) => (totalUsage[category.id] || 0) >= headcount);
  }, [categories, headcount, totalUsage]);

  const addToCart = (item: MenuItem, category: MenuCategory) => {
    const check = canAdd({
      cart,
      category,
      itemId: item.id,
      addQty: 1,
      headcount,
      backendUsage,
    });

    if (!check.ok) {
      setTransientError(check.reason);
      return;
    }

    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);

      if (existing) {
        next.set(item.id, { ...existing, qty: existing.qty + 1 });
      } else {
        next.set(item.id, {
          itemId: item.id,
          itemKey: item.key,
          nameEn: item.nameEn || item.key,
          nameTc: item.nameTc || item.nameEn || item.key,
          nameSc: item.nameSc || item.nameEn || item.key,
          categoryId: category.id,
          categoryNameEn: category.nameEn,
          categoryNameTc: category.nameTc || category.nameEn,
          categoryNameSc: category.nameSc || category.nameEn,
          categoryOrderMode: category.orderMode,
          categoryLimitMode: category.limitMode,
          qty: 1,
        });
      }

      return next;
    });
  };

  const decrementItem = (itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (!existing) {
        return next;
      }

      if (existing.qty <= 1) {
        next.delete(itemId);
      } else {
        next.set(itemId, { ...existing, qty: existing.qty - 1 });
      }

      return next;
    });
  };

  const toggleOneOff = (item: MenuItem, category: MenuCategory) => {
    const existing = cart.get(item.id);
    if (existing) {
      setCart((prev) => {
        const next = new Map(prev);
        next.delete(item.id);
        return next;
      });
      return;
    }

    addToCart(item, category);
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(itemId);
      return next;
    });
  };

  const submitOrder = async () => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const items = [...cart.values()].map((item) => ({
        itemId: item.itemId,
        qty: item.qty,
      }));

      const order = await guestFetch<{ id: string }>(
        '/orders',
        {
          method: 'POST',
          body: JSON.stringify({ items }),
        },
        branding.token,
      );

      setCart(new Map());
      await refetch();
      navigate('/order-confirmation', { state: { orderId: order.id } });
    } catch (error) {
      const code = error instanceof GuestApiError ? error.code : 'NETWORK';
      setSubmitError(code);
    } finally {
      setSubmitting(false);
    }
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-8 text-center">
        <div>
          <p className="mb-3 text-foreground/60">No active session.</p>
          <button type="button" onClick={() => navigate('/')} className="text-primary hover:underline">
            Return to welcome page
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (error || !categories) {
    return (
      <div className="flex h-screen items-center justify-center px-8 text-center">
        <div>
          <p className="mb-2 text-red-700">Failed to load menu.</p>
          <p className="text-xs text-foreground/50">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="bg-primary px-6 py-2 text-xs text-primary-foreground">
        <div className="flex items-center justify-between">
          <span className="opacity-85">{formatNowLocale(now, language)}</span>
          <span className="flex items-center gap-3 opacity-85">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
            <span>Connected</span>
            <span>WiFi</span>
            <span>72%</span>
          </span>
        </div>
      </div>

      {transientError ? (
        <div
          className={[
            'border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700 sm:px-6',
            transientErrorClosing ? 'animate-out fade-out duration-200' : 'animate-in fade-in duration-200',
          ].join(' ')}
        >
          {t(`errors.${transientError}`, { defaultValue: transientError })}
        </div>
      ) : null}

      <header className="flex items-center justify-between border-b border-white/10 bg-primary px-4 py-4 text-primary-foreground sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-lg font-semibold text-primary shadow-sm">
            M
          </div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm sm:tracking-[0.24em]">
            {branding.siteName}
          </span>
          <nav className="ml-6 hidden items-center gap-6 text-sm md:flex">
            <span className="opacity-60">Home</span>
            <span className="opacity-100">Menu</span>
            <span className="opacity-60">Concierge</span>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm">
            <Users size={14} />
            <span>Party of {session.headcount}</span>
          </div>
          <LanguageToggle />
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <CategorySidebar
          categories={categories}
          currentCategoryId={effectiveCategoryId}
          onSelect={setCurrentCategoryId}
          headcount={headcount}
          usage={totalUsage}
        />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {currentCategory ? (
            <>
              {allCategoriesFull ? (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900">
                  {t('menu.allCategoriesFull')}
                </div>
              ) : null}

              <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-serif text-2xl text-foreground/90 sm:text-3xl">
                  {pickByLang(
                    {
                      en: currentCategory.nameEn,
                      tc: currentCategory.nameTc,
                      sc: currentCategory.nameSc,
                    },
                    language,
                    currentCategory.nameEn,
                  )}
                </h2>

                <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-3">
                  <span className="rounded-full bg-foreground/5 px-3 py-1 text-foreground/60">
                    {t('menu.used', { used: totalUsage[currentCategory.id] || 0, cap: headcount })}
                  </span>
                  <span className="uppercase tracking-[0.24em] text-foreground/40">
                    {t('menu.items', { count: currentCategory.items.length })}
                  </span>
                </div>
              </div>

              <p className="mb-6 text-xs italic text-foreground/50">
                {t('menu.upTo', { cap: headcount })}
              </p>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {currentCategory.items.map((item) => {
                  const state = getItemState({
                    cart,
                    category: currentCategory,
                    itemId: item.id,
                    headcount,
                    backendUsage,
                  });

                  return (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      category={currentCategory}
                      qty={state.qty}
                      disabled={state.disabled}
                      reason={state.reason}
                      onIncrement={() => addToCart(item, currentCategory)}
                      onDecrement={() => decrementItem(item.id)}
                      onToggle={() => toggleOneOff(item, currentCategory)}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-foreground/50">No categories available.</div>
          )}
        </main>
        <CartPanel
          cart={cart}
          onRemove={removeFromCart}
          onSubmit={() => void submitOrder()}
          submitting={submitting}
          submitError={submitError}
        />
      </div>
    </div>
  );
}

function formatNowLocale(now: Date, lang: Language): string {
  const locale = lang === 'sc' ? 'zh-CN' : lang === 'tc' ? 'zh-HK' : 'en-US';
  const date = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(now);

  return `${time} · ${date}`;
}
