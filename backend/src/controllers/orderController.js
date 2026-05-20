const prisma = require('../lib/prismaWithTenant');
const basePrisma = require('../lib/prisma');
const { checkAndRecord } = require('../services/sessionLimit');
const { getActiveSession } = require('../services/roomSession');

// ============================================================
// DEPRECATED: This controller is kept for E2-06 30-day compat window.
// After: 2026-06-14, this controller will be REMOVED.
// Replacement:
//   - Guest:   /api/guest/orders (uses room_token)
//   - Admin:   /api/admin/orders (uses JWT, E4 implementation)
// ============================================================

function respondOrderCompatDisabled(req, res) {
  return res.status(503).json({
    error: 'Orders API is partially disabled in V4 compatibility mode',
    code: 'E1_V4_COMPAT_PARTIAL',
    feature: 'orders',
    todo: 'E2-TODO: rebuild list/status/AI-ready workflows against V4 lifecycle',
  });
}

async function getOrders(req, res, next) {
  try {
    const callerType = req.ctx?.userId
      ? `jwt:${req.ctx.role || 'UNKNOWN'}:${req.ctx.userId}`
      : req.authType === 'api_key'
        ? 'api_key'
        : 'unknown';
    console.warn(
      `[DEPRECATED] getOrders compat path used by ${callerType} on ${req.method} ${req.originalUrl}. Migrate to /api/admin/orders when E4 lands.`,
    );

    const where = {};
    if (req.ctx?.tenantId) {
      where.tenantId = req.ctx.tenantId;
    }
    if (typeof req.query.roomId === 'string' && req.query.roomId.trim()) {
      where.roomId = req.query.roomId.trim();
    }
    if (typeof req.query.status === 'string' && req.query.status.trim()) {
      where.status = req.query.status.trim();
    }
    if (typeof req.query.siteId === 'string' && req.query.siteId.trim()) {
      where.siteId = req.query.siteId.trim();
    }
    if (typeof req.query.sessionId === 'string' && req.query.sessionId.trim()) {
      where.sessionId = req.query.sessionId.trim();
    }

    const orders = await basePrisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });

    return res.json(orders);
  } catch (e) {
    return next(e);
  }
}

async function createOrder(req, res, next) {
  try {
    const callerType = req.ctx?.userId
      ? `jwt:${req.ctx.role || 'UNKNOWN'}:${req.ctx.userId}`
      : req.authType === 'api_key'
        ? `api_key:${req.headers['x-api-key-name'] || 'unknown'}`
        : 'unknown';
    console.warn(
      `[DEPRECATED] createOrder compat path used by ${callerType} on ${req.method} ${req.originalUrl}. Migrate to /api/guest/orders or /api/admin/orders.`,
    );

    const { roomId, items } = req.body || {};
    if (!roomId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'roomId and items required' });
    }

    for (const item of items) {
      if (!item || typeof item.itemId !== 'string' || !item.itemId.trim()) {
        return res.status(400).json({ error: 'INVALID_ITEM_ID' });
      }
      if (!Number.isInteger(item.qty) || item.qty < 1) {
        return res.status(400).json({ error: 'INVALID_QTY' });
      }
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const tenantId = req.ctx?.tenantId || room.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'TENANT_REQUIRED' });
    }

    const session = await getActiveSession({ tenantId, roomId });
    if (!session) {
      return res.status(400).json({ error: 'NO_ACTIVE_SESSION' });
    }

    const itemIds = [...new Set(items.map((item) => item.itemId.trim()))];
    const dbItems = await prisma.menuItem.findMany({
      where: { id: { in: itemIds } },
      include: { category: true },
    });
    if (dbItems.length !== itemIds.length) {
      return res.status(404).json({ error: 'Some items not found' });
    }

    const byId = new Map(dbItems.map((item) => [item.id, item]));
    const invalidSiteItem = dbItems.find((item) => item.siteId !== room.siteId || item.tenantId !== tenantId);
    if (invalidSiteItem) {
      return res.status(400).json({ error: 'ITEM_SITE_MISMATCH', itemId: invalidSiteItem.id });
    }

    const order = await basePrisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM room_sessions
        WHERE id = ${session.id} AND tenant_id = ${tenantId}
        FOR UPDATE
      `;

      for (const requested of items) {
        const dbItem = byId.get(requested.itemId.trim());
        await checkAndRecord(tx, {
          tenantId,
          session,
          category: dbItem.category,
          itemId: dbItem.id,
          qty: requested.qty,
        });
      }

      return tx.order.create({
        data: {
          tenantId,
          siteId: room.siteId,
          roomId,
          sessionId: session.id,
          items: items.map((item) => ({
            itemId: item.itemId.trim(),
            qty: item.qty,
            name: byId.get(item.itemId.trim()).key,
          })),
          status: 'pending',
        },
      });
    });

    // E4-07: tenant-scoped fanout with operator-shaped payload (same
    // path as the guest endpoint; this controller is deprecated but kept
    // consistent so any straggler caller doesn't leak across tenants).
    try {
      const io = req.app.get('socketio');
      if (io) {
        const { enrichOrderForOperator } = require('../services/orderEnrichment');
        const enriched = await enrichOrderForOperator(order.id, { prisma });
        if (enriched) {
          io.to(`tenant:${enriched.tenantId}`).emit('new_ticket', enriched);
        }
      }
    } catch (emitErr) {
      console.error('[orderController compat] new_ticket emit failed:', emitErr);
    }

    return res.status(201).json(order);
  } catch (e) {
    if (
      [
        'ITEM_TAKEN',
        'CATEGORY_FULL',
        'ITEM_LIMIT_REACHED',
        'CONCURRENT_USAGE_CONFLICT',
        'INVALID_QTY_FOR_ONE_OFF',
        'INVALID_QTY',
        'NO_ACTIVE_SESSION',
        'TENANT_REQUIRED',
        'ITEM_REQUIRED',
      ].includes(e.code)
    ) {
      return res.status(400).json({ error: e.code, ...(e.meta || {}) });
    }
    return next(e);
  }
}

const getOrderStats = respondOrderCompatDisabled;
const updateOrderStatus = respondOrderCompatDisabled;
const updateAiReadyFlag = respondOrderCompatDisabled;

module.exports = {
  createOrder,
  getOrders,
  getOrderStats,
  updateOrderStatus,
  updateAiReadyFlag,
};
