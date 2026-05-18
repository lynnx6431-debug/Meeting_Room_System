import { Check, Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import type { MenuCategory, MenuItem } from '../hooks/useMenu';
import { pickByLang } from '../lib/pickByLang';

type MenuItemCardProps = {
  item: MenuItem;
  category: MenuCategory;
  qty: number;
  disabled: boolean;
  reason?: 'CATEGORY_FULL' | 'ITEM_LIMIT_REACHED' | 'ITEM_TAKEN';
  onIncrement: () => void;
  onDecrement: () => void;
  onToggle?: () => void;
};

export function MenuItemCard({
  item,
  category,
  qty,
  disabled,
  reason,
  onIncrement,
  onDecrement,
  onToggle,
}: MenuItemCardProps) {
  const { language } = useLanguage();
  const { t } = useTranslation();

  const name = pickByLang(
    { en: item.nameEn, tc: item.nameTc, sc: item.nameSc },
    language,
    item.nameEn || item.key,
  );

  const desc = pickByLang(
    { en: item.descEn, tc: item.descTc, sc: item.descSc },
    language,
    item.descEn || '',
  );

  const isOneOff = category.orderMode === 'one_off';
  const isSelected = qty > 0;
  const showFull = disabled && qty === 0;

  if (isOneOff) {
    const oneOffShowFull = disabled && qty === 0;
    const oneOffSelected = qty > 0;

    return (
      <div
        onClick={!disabled || oneOffSelected ? onToggle : undefined}
        className={[
          'relative flex h-32 overflow-hidden rounded-2xl border bg-white transition-all',
          oneOffShowFull
            ? 'cursor-not-allowed border-foreground/10 opacity-60 grayscale'
            : oneOffSelected
              ? 'cursor-pointer border-primary/40 bg-primary/5 shadow-md'
              : 'cursor-pointer border-foreground/10 hover:shadow-md',
        ].join(' ')}
      >
        <div className="flex w-32 shrink-0 items-center justify-center bg-gradient-to-br from-foreground/10 to-foreground/5 text-foreground/30">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <div className="text-xs italic">no image</div>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
          <div>
            <div className="truncate font-serif text-lg text-foreground/90">{name}</div>
            {desc ? <div className="mt-1 text-xs italic text-foreground/50 line-clamp-2">{desc}</div> : null}
          </div>

          {oneOffShowFull ? (
            <div className="text-xs font-medium uppercase tracking-[0.28em] text-foreground/40">
              {reason ? t(`errors.${reason}`, { defaultValue: t('menu.categoryFull') }) : t('menu.categoryFull')}
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span
                className={[
                  'text-xs font-medium uppercase tracking-[0.28em]',
                  oneOffSelected ? 'text-primary' : 'text-primary/70',
                ].join(' ')}
              >
                {oneOffSelected ? t('menu.selected') : <>{t('menu.tapToAdd')} &rarr;</>}
              </span>
              {oneOffSelected ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check size={14} />
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'relative flex h-32 overflow-hidden rounded-2xl border bg-white transition-all',
        showFull
          ? 'border-foreground/10 opacity-60 grayscale'
          : isSelected
            ? 'border-primary/40 shadow-md'
            : 'border-foreground/10 hover:shadow-md',
      ].join(' ')}
    >
      <div className="flex w-32 shrink-0 items-center justify-center bg-gradient-to-br from-foreground/10 to-foreground/5 text-foreground/30">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="text-xs italic">no image</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <div>
          <div className="truncate font-serif text-lg text-foreground/90">{name}</div>
          {desc ? <div className="mt-1 text-xs italic text-foreground/50 line-clamp-2">{desc}</div> : null}
        </div>

        {showFull ? (
          <div className="text-xs font-medium uppercase tracking-[0.28em] text-foreground/40">
            {reason ? t(`errors.${reason}`, { defaultValue: t('menu.categoryFull') }) : t('menu.categoryFull')}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {qty === 0 ? (
              <button
                type="button"
                onClick={onIncrement}
                disabled={disabled}
                className="text-xs font-medium uppercase tracking-[0.28em] text-primary transition-colors hover:text-primary/80 disabled:opacity-40"
              >
                {t('menu.tapToAdd')} &rarr;
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onDecrement}
                  aria-label={t('menu.decrement')}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-foreground/20 text-foreground/70 hover:bg-foreground/5"
                >
                  <Minus size={14} />
                </button>
                <span className="w-6 text-center font-serif text-lg tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={onIncrement}
                  disabled={disabled}
                  aria-label={t('menu.increment')}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
