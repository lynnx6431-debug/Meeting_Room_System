import { Loader2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import type { CartItem } from '../lib/cartCapacity';
import { pickByLang } from '../lib/pickByLang';

type CartPanelProps = {
  cart: Map<string, CartItem>;
  onRemove: (itemId: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  submitError: string | null;
};

export function CartPanel({ cart, onRemove, onSubmit, submitting, submitError }: CartPanelProps) {
  const { t } = useTranslation();
  const { language } = useLanguage();

  const items = [...cart.values()];
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const isEmpty = items.length === 0;

  return (
    <aside className="bg-background lg:flex lg:h-full lg:w-80 lg:flex-col lg:border-l lg:border-foreground/10">
      <div className="border-t border-foreground/10 bg-background px-4 py-3 lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-foreground/40">{t('menu.yourSelection')}</div>
            <div className="font-serif text-lg">{t('menu.itemCount', { count: totalQty })}</div>
          </div>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isEmpty || submitting}
            className={[
              'rounded-full px-5 py-2.5 text-sm font-medium transition',
              isEmpty
                ? 'cursor-not-allowed bg-foreground/10 text-foreground/40'
                : 'bg-primary text-primary-foreground hover:opacity-95',
              'disabled:opacity-60',
            ].join(' ')}
          >
            {submitting ? t('menu.submitting') : t('menu.placeOrder')}
          </button>
        </div>
        {submitError ? (
          <div
            className="animate-in fade-in duration-200 mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700"
            role="alert"
          >
            {t(`errors.${submitError}`, { defaultValue: submitError })}
          </div>
        ) : null}
      </div>

      <div className="hidden lg:flex lg:h-full lg:flex-col">
        <div className="border-b border-foreground/10 px-6 py-5">
          <div className="mb-1 text-xs uppercase tracking-[0.28em] text-foreground/40">
            {t('menu.yourSelection')}
          </div>
          <div className="font-serif text-2xl">{t('menu.itemCount', { count: totalQty })}</div>
        </div>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 h-12 w-12 rounded-full border border-foreground/15" />
            <div className="mb-1 text-foreground/60">{t('menu.noItemsSelected')}</div>
            <div className="text-xs text-foreground/40">{t('menu.chooseFromCatalogue')}</div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {groupByCategory(items).map(([categoryId, group]) => (
              <div key={categoryId} className="mb-4">
                <div className="mb-1 px-3 text-[10px] uppercase tracking-[0.28em] text-foreground/40">
                  {pickByLang(
                    {
                      en: group[0].categoryNameEn,
                      tc: group[0].categoryNameTc,
                      sc: group[0].categoryNameSc,
                    },
                    language,
                    group[0].categoryNameEn,
                  )}
                </div>

                {group.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {pickByLang(
                          {
                            en: item.nameEn,
                            tc: item.nameTc,
                            sc: item.nameSc,
                          },
                          language,
                          item.nameEn,
                        )}
                      </div>
                      {item.qty > 1 ? <div className="mt-0.5 text-xs text-foreground/40">×{item.qty}</div> : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemove(item.itemId)}
                      className="ml-2 p-1 text-foreground/30 transition-colors hover:text-red-500"
                      aria-label={t('menu.removeFromCart')}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {submitError ? (
          <div
            className="animate-in fade-in duration-200 border-t border-red-200 bg-red-50 px-6 py-3 text-xs text-red-700"
            role="alert"
          >
            {t(`errors.${submitError}`, { defaultValue: submitError })}
          </div>
        ) : null}

        <div className="border-t border-foreground/10 p-6">
          <button
            type="button"
            onClick={onSubmit}
            disabled={isEmpty || submitting}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-full py-3.5 font-medium tracking-wide transition',
              isEmpty
                ? 'cursor-not-allowed bg-foreground/10 text-foreground/40'
                : 'bg-primary text-primary-foreground hover:opacity-95',
              'disabled:opacity-60',
            ].join(' ')}
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('menu.submitting')}
              </>
            ) : (
              t('menu.placeOrder')
            )}
          </button>
          <div className="mt-3 text-center text-xs text-foreground/30">Served by Manulife</div>
        </div>
      </div>
    </aside>
  );
}

function groupByCategory(items: CartItem[]): [string, CartItem[]][] {
  const grouped = new Map<string, CartItem[]>();
  for (const item of items) {
    if (!grouped.has(item.categoryId)) {
      grouped.set(item.categoryId, []);
    }
    grouped.get(item.categoryId)?.push(item);
  }
  return [...grouped.entries()];
}
