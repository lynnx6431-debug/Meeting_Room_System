// Shared "operator-shaped" order enrichment.
//
// The /api/operator/orders endpoint and the Socket.IO ticket emitters must
// hand the operator UI exactly the same object shape; otherwise a card patched
// from `ticket_updated` loses fields it had from the initial fetch. This
// service is the single source of truth for that shape.
//
// Note: Order.items is a JSON blob in the schema (no relational OrderItem),
// so resolving itemId -> {categoryId, localized names} is an application-side
// join — one menu_items SELECT per call, regardless of how many orders.
const prismaDefault = require('../lib/prisma');

function enrichItemsJson(itemsJson, itemMap) {
  return (Array.isArray(itemsJson) ? itemsJson : []).map((it) => {
    const mi = it && it.itemId ? itemMap.get(it.itemId) : null;
    return {
      itemId: it && it.itemId,
      qty: it && it.qty,
      name: it && it.name,
      categoryId: mi ? mi.categoryId : null,
      nameEn: mi ? mi.nameEn : (it && it.name) || null,
      nameTc: mi ? mi.nameTc : (it && it.name) || null,
      nameSc: mi ? mi.nameSc : (it && it.name) || null,
    };
  });
}

/**
 * Batch enrich. Returns enriched orders in the same order as `orderIds`
 * (missing ids drop silently — the caller's responsibility to handle).
 *
 * @param {string[]} orderIds
 * @param {{ prisma?: any }} [opts]
 * @returns {Promise<EnrichedOrder[]>}
 */
async function enrichOrdersForOperator(orderIds, opts = {}) {
  const prisma = opts.prisma || prismaDefault;
  if (!Array.isArray(orderIds) || orderIds.length === 0) return [];

  const rawOrders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      tenantId: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      completedAt: true,
      items: true,
      room: {
        select: { id: true, code: true, name: true, nameEn: true, nameTc: true, nameSc: true },
      },
      session: { select: { id: true, headcount: true } },
    },
  });

  const itemIds = [
    ...new Set(
      rawOrders.flatMap((o) =>
        Array.isArray(o.items) ? o.items.map((it) => it && it.itemId).filter(Boolean) : [],
      ),
    ),
  ];
  const menuItems = itemIds.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, categoryId: true, nameEn: true, nameTc: true, nameSc: true },
      })
    : [];
  const itemMap = new Map(menuItems.map((m) => [m.id, m]));
  const byId = new Map(rawOrders.map((o) => [o.id, o]));

  return orderIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((o) => ({
      id: o.id,
      tenantId: o.tenantId, // surfaced so emitters can fan out by tenant
      status: o.status,
      createdAt: o.createdAt,
      acknowledgedAt: o.acknowledgedAt,
      completedAt: o.completedAt,
      sessionId: o.session ? o.session.id : null,
      headcount: o.session ? o.session.headcount : null,
      room: o.room,
      items: enrichItemsJson(o.items, itemMap),
    }));
}

/**
 * Single-order convenience. Returns null if the order doesn't exist.
 *
 * @param {string} orderId
 * @param {{ prisma?: any }} [opts]
 * @returns {Promise<EnrichedOrder|null>}
 */
async function enrichOrderForOperator(orderId, opts = {}) {
  const [order] = await enrichOrdersForOperator([orderId], opts);
  return order || null;
}

module.exports = { enrichOrderForOperator, enrichOrdersForOperator };
