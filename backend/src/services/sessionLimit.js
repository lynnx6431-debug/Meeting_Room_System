async function checkAndRecord(tx, { tenantId, session, category, itemId, qty }) {
  const { id: sessionId, headcount, roomId } = session;
  const { id: categoryId, orderMode, limitMode } = category;

  if (!tenantId) {
    const err = new Error('TENANT_REQUIRED');
    err.code = 'TENANT_REQUIRED';
    throw err;
  }
  if (!itemId) {
    const err = new Error('ITEM_REQUIRED');
    err.code = 'ITEM_REQUIRED';
    throw err;
  }
  if (!Number.isInteger(qty) || qty < 1) {
    const err = new Error('INVALID_QTY');
    err.code = 'INVALID_QTY';
    throw err;
  }
  if (orderMode === 'one_off' && qty !== 1) {
    const err = new Error('INVALID_QTY_FOR_ONE_OFF');
    err.code = 'INVALID_QTY_FOR_ONE_OFF';
    throw err;
  }

  if (orderMode === 'one_off') {
    const taken = await tx.sessionCategoryUsage.findFirst({
      where: { sessionId, categoryId, itemId },
    });
    if (taken) {
      const err = new Error('ITEM_TAKEN');
      err.code = 'ITEM_TAKEN';
      err.meta = { itemId };
      throw err;
    }

    if (limitMode === 'total_per_category') {
      const agg = await tx.sessionCategoryUsage.aggregate({
        where: { sessionId, categoryId },
        _sum: { quantityUsed: true },
      });
      const used = agg._sum.quantityUsed || 0;
      if (used + 1 > headcount) {
        const err = new Error('CATEGORY_FULL');
        err.code = 'CATEGORY_FULL';
        err.meta = { categoryId, headcount, used };
        throw err;
      }
    }
  } else if (limitMode === 'per_item') {
    const existing = await tx.sessionCategoryUsage.findFirst({
      where: { sessionId, categoryId, itemId },
    });
    const used = existing?.quantityUsed || 0;
    if (used + qty > headcount) {
      const err = new Error('ITEM_LIMIT_REACHED');
      err.code = 'ITEM_LIMIT_REACHED';
      err.meta = { itemId, headcount, used };
      throw err;
    }
  } else {
    const agg = await tx.sessionCategoryUsage.aggregate({
      where: { sessionId, categoryId },
      _sum: { quantityUsed: true },
    });
    const used = agg._sum.quantityUsed || 0;
    if (used + qty > headcount) {
      const err = new Error('CATEGORY_FULL');
      err.code = 'CATEGORY_FULL';
      err.meta = { categoryId, headcount, used };
      throw err;
    }
  }

  const usageItem = orderMode === 'one_off' || limitMode === 'per_item' ? itemId : null;

  try {
    const existing = await tx.sessionCategoryUsage.findFirst({
      where: { sessionId, categoryId, itemId: usageItem },
    });

    if (existing) {
      await tx.sessionCategoryUsage.update({
        where: { id: existing.id },
        data: { quantityUsed: existing.quantityUsed + qty },
      });
    } else {
      await tx.sessionCategoryUsage.create({
        data: {
          sessionId,
          roomId,
          categoryId,
          itemId: usageItem,
          quantityUsed: qty,
        },
      });
    }
  } catch (e) {
    if (e.code === 'P2002') {
      const err = new Error(orderMode === 'one_off' ? 'ITEM_TAKEN' : 'CONCURRENT_USAGE_CONFLICT');
      err.code = orderMode === 'one_off' ? 'ITEM_TAKEN' : 'CONCURRENT_USAGE_CONFLICT';
      err.meta = { categoryId, itemId };
      throw err;
    }
    throw e;
  }

  return { allowed: true };
}

module.exports = { checkAndRecord };
