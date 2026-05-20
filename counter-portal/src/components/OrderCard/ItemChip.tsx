import { useLanguage } from '../../context/LanguageContext';
import type { OperatorCategory } from '../../hooks/useOperatorCategories';
import type { OperatorOrderItem } from '../../hooks/useOperatorOrders';
import { pickByLang } from '../../lib/pickByLang';

export function ItemChip({
  item,
  category,
}: {
  item: OperatorOrderItem;
  category?: OperatorCategory;
}) {
  const { language } = useLanguage();

  const itemName = pickByLang(
    { en: item.nameEn, tc: item.nameTc, sc: item.nameSc },
    language,
    item.name,
  );
  const categoryName = category
    ? pickByLang(
        { en: category.nameEn, tc: category.nameTc, sc: category.nameSc },
        language,
        category.nameEn,
      )
    : null;

  return (
    <span className="inline-flex items-center gap-2 rounded-md border border-border bg-background-elevated px-3 py-1.5 text-sm">
      <span className="tabular-nums text-foreground-muted">×{item.qty}</span>
      <span className="text-foreground">{itemName}</span>
      {categoryName ? (
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">
          {categoryName}
        </span>
      ) : null}
    </span>
  );
}
