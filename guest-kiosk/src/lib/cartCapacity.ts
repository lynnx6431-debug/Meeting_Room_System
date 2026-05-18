import type { MenuCategory } from '../hooks/useMenu';
import type { SessionUsage } from '../api/types';

export type CartItem = {
  itemId: string;
  itemKey: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
  categoryId: string;
  categoryNameEn: string;
  categoryNameTc: string;
  categoryNameSc: string;
  categoryOrderMode: 'quantity' | 'one_off';
  categoryLimitMode: 'total_per_category' | 'per_item';
  qty: number;
};

export function getCategoryUsage(cart: Map<string, CartItem>, categoryId: string): number {
  let total = 0;
  for (const item of cart.values()) {
    if (item.categoryId === categoryId) {
      total += item.qty;
    }
  }
  return total;
}

function getBackendItemUsage(backendUsage: SessionUsage[], categoryId: string, itemId: string): number {
  return backendUsage
    .filter((usage) => usage.categoryId === categoryId && usage.itemId === itemId)
    .reduce((sum, usage) => sum + usage.quantityUsed, 0);
}

function getBackendCategoryUsage(backendUsage: SessionUsage[], categoryId: string): number {
  return backendUsage
    .filter((usage) => usage.categoryId === categoryId)
    .reduce((sum, usage) => sum + usage.quantityUsed, 0);
}

export function canAdd({
  cart,
  category,
  itemId,
  addQty,
  headcount,
  backendUsage,
}: {
  cart: Map<string, CartItem>;
  category: MenuCategory;
  itemId: string;
  addQty: number;
  headcount: number;
  backendUsage: SessionUsage[];
}):
  | { ok: true }
  | { ok: false; reason: 'CATEGORY_FULL' | 'ITEM_LIMIT_REACHED' | 'ITEM_TAKEN' } {
  if (category.orderMode === 'one_off') {
    const existing = cart.get(itemId);
    if (existing) {
      return { ok: false, reason: 'ITEM_TAKEN' };
    }
    const alreadyOrdered = backendUsage.some((usage) => usage.categoryId === category.id && usage.itemId === itemId);
    if (alreadyOrdered) {
      return { ok: false, reason: 'ITEM_TAKEN' };
    }
    if (addQty !== 1) {
      return { ok: false, reason: 'ITEM_LIMIT_REACHED' };
    }

    if (category.limitMode === 'total_per_category') {
      const used = getBackendCategoryUsage(backendUsage, category.id) + getCategoryUsage(cart, category.id);
      if (used + 1 > headcount) {
        return { ok: false, reason: 'CATEGORY_FULL' };
      }
    }
  } else if (category.limitMode === 'per_item') {
    const existing = cart.get(itemId);
    const cartQty = existing?.qty || 0;
    const backendQty = getBackendItemUsage(backendUsage, category.id, itemId);
    if (backendQty + cartQty + addQty > headcount) {
      return { ok: false, reason: 'ITEM_LIMIT_REACHED' };
    }
  } else {
    const used = getBackendCategoryUsage(backendUsage, category.id) + getCategoryUsage(cart, category.id);
    if (used + addQty > headcount) {
      return { ok: false, reason: 'CATEGORY_FULL' };
    }
  }

  return { ok: true };
}

export function getItemState({
  cart,
  category,
  itemId,
  headcount,
  backendUsage,
}: {
  cart: Map<string, CartItem>;
  category: MenuCategory;
  itemId: string;
  headcount: number;
  backendUsage: SessionUsage[];
}): {
  qty: number;
  disabled: boolean;
  reason?: 'CATEGORY_FULL' | 'ITEM_LIMIT_REACHED' | 'ITEM_TAKEN';
} {
  const existing = cart.get(itemId);
  const qty = existing?.qty || 0;
  const check = canAdd({ cart, category, itemId, addQty: 1, headcount, backendUsage });

  if (check.ok) {
    return { qty, disabled: false };
  }

  return { qty, disabled: true, reason: check.reason };
}
