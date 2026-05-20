const express = require('express');
const prisma = require('../lib/prisma');
const { validateJwt } = require('../middleware/auth');
const { enrichOrderForOperator, enrichOrdersForOperator } = require('../services/orderEnrichment');

const router = express.Router();

router.use(validateJwt);

/**
 * Resolve the operator's tenant, room scope (RoomOperatorAssignment) and
 * category scope (MenuCategory.defaultOperatorId == user). Shared by
 * GET /orders and the ack/complete endpoints so RBAC stays Option C in
 * exactly one place.
 *
 * Returns null when the user has no tenant (non-SUPER_ADMIN) — caller
 * should treat it as a 403.
 */
async function loadOperatorAllowance({ userId, role }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true },
  });
  if (!user) return { error: { status: 401, code: 'USER_NOT_FOUND' } };
  if (!user.tenantId && role !== 'SUPER_ADMIN') {
    return { error: { status: 403, code: 'NO_TENANT' } };
  }

  const [assignments, ownedCategories] = await Promise.all([
    prisma.roomOperatorAssignment.findMany({
      where: { operatorUserId: userId },
      select: { roomId: true },
    }),
    prisma.menuCategory.findMany({
      where: {
        defaultOperatorId: userId,
        ...(role === 'SUPER_ADMIN' ? {} : { tenantId: user.tenantId }),
      },
      select: { id: true },
    }),
  ]);

  return {
    user,
    allowedRoomIds: assignments.map((a) => a.roomId),
    allowedCategoryIds: ownedCategories.map((c) => c.id),
  };
}

// Option C: an order is visible if it sits in an operator-assigned room AND
// contains >=1 item whose category the operator is the default operator for.
function isOrderVisible(enrichedOrder, allowedRoomIds, allowedCategoryIds) {
  if (!allowedRoomIds.includes(enrichedOrder.room.id)) return false;
  const allowed = new Set(allowedCategoryIds);
  return enrichedOrder.items.some((it) => it.categoryId && allowed.has(it.categoryId));
}

// Tenant-scoped Socket.IO broadcast. Keeps cross-tenant leakage out of the
// wire even before the client gets to filter. Pulls io off the express app
// (set in src/index.js).
function emitToTenant(req, tenantId, event, payload) {
  const io = req.app.get('socketio');
  if (!io || !tenantId) return;
  io.to(`tenant:${tenantId}`).emit(event, payload);
}

/**
 * GET /api/operator/categories
 *
 * Active menu categories for the current user's tenant, plus the id of the
 * category this operator is the default operator for (used by the counter
 * portal to auto-select the operator's own tab on first load — V4.4 §5.3).
 *
 * RBAC: any authenticated user. SUPER_ADMIN sees all tenants' categories;
 * everyone else is scoped to their own tenant.
 *
 * Notes:
 * - menu_categories has no `active`/`is_active` column, so there is no
 *   active filter (verified against the live schema).
 * - validateJwt sets req.admin = { id, role } (no tenantId in the token),
 *   so the tenant is resolved from the user record.
 */
router.get('/categories', async (req, res, next) => {
  try {
    const userId = req.admin.id;
    const role = req.admin.role;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'USER_NOT_FOUND' });
    }
    if (!user.tenantId && role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'NO_TENANT' });
    }

    const where = role === 'SUPER_ADMIN' ? {} : { tenantId: user.tenantId };

    const categories = await prisma.menuCategory.findMany({
      where,
      select: {
        id: true,
        key: true,
        nameEn: true,
        nameTc: true,
        nameSc: true,
        orderMode: true,
        limitMode: true,
        sortOrder: true,
        defaultOperatorId: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });

    // The operator may be the default for several categories; pick the first
    // by sort order so the default tab is deterministic.
    const defaultCategory = categories.find((c) => c.defaultOperatorId === userId);

    return res.json({
      categories: categories.map(({ defaultOperatorId, ...c }) => c),
      defaultCategoryId: defaultCategory ? defaultCategory.id : null,
    });
  } catch (e) {
    next(e);
  }
});

/**
 * GET /api/operator/orders
 *
 * RBAC (V4.4 §5.2), Option C — an order is visible if it is in one of the
 * operator's assigned rooms AND contains at least one item belonging to a
 * category this operator is the default operator for. The whole order is
 * returned (full context); the tab view focuses a single category.
 *
 * Schema realities (verified, differ from the original spec):
 * - Order.items is a JSON blob [{itemId,qty,name}] with NO categoryId, so the
 *   category join is done in application code (itemId -> menu_items.categoryId).
 * - OrderStatus enum is lowercase pending|acknowledged|done. There is no
 *   OVERDUE/COMPLETED. "active" = pending|acknowledged; OVERDUE is derived on
 *   the client from createdAt (no backend timer exists).
 * - headcount lives on RoomSession (Order.sessionId -> session), not Order.
 *
 * Query params:
 *   - status: all | pending | acknowledged | done   (default: active)
 *   - categoryId: focus a single category the operator owns
 *   - limit: default 50
 */
router.get('/orders', async (req, res, next) => {
  try {
    const allowance = await loadOperatorAllowance({
      userId: req.admin.id,
      role: req.admin.role,
    });
    if (allowance.error) {
      return res.status(allowance.error.status).json({ error: allowance.error.code });
    }
    const { allowedRoomIds, allowedCategoryIds } = allowance;
    const meta = { allowedRoomIds, allowedCategoryIds };

    if (allowedRoomIds.length === 0 || allowedCategoryIds.length === 0) {
      return res.json({ orders: [], total: 0, meta });
    }

    const { status, categoryId } = req.query;
    const limit = Math.min(Number(req.query.limit) || 50, 200);

    let statusWhere;
    if (status === 'all') {
      statusWhere = {};
    } else if (status === 'pending' || status === 'acknowledged' || status === 'done') {
      statusWhere = { status };
    } else {
      statusWhere = { status: { in: ['pending', 'acknowledged'] } }; // active
    }

    // A categoryId filter must reference a category the operator owns.
    let focusCategoryId = null;
    if (categoryId && categoryId !== 'all') {
      if (!allowedCategoryIds.includes(categoryId)) {
        return res.json({ orders: [], total: 0, meta });
      }
      focusCategoryId = categoryId;
    }

    // Step 1: cheap id query within room+status scope.
    const idRows = await prisma.order.findMany({
      where: { roomId: { in: allowedRoomIds }, ...statusWhere },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const orderIds = idRows.map((r) => r.id);

    // Step 2: enrich via shared service (single source of truth for the
    // operator order shape — also used by the Socket.IO emitters).
    const enriched = await enrichOrdersForOperator(orderIds, { prisma });

    // Step 3: Option C category filter + optional tab focus.
    const orders = enriched
      .filter((o) => isOrderVisible(o, allowedRoomIds, allowedCategoryIds))
      .filter((o) =>
        focusCategoryId ? o.items.some((it) => it.categoryId === focusCategoryId) : true,
      );

    return res.json({ orders, total: orders.length, meta });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/operator/sessions/:sessionId/headcount
 *
 * Operator headcount override (V4.4 §5.3). RBAC: the operator must be
 * assigned to the session's room. Only an occupied session may be changed.
 * Body: { headcount: number }  (1..50)
 */
router.patch('/sessions/:sessionId/headcount', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const headcount = Number(req.body && req.body.headcount);

    if (!Number.isInteger(headcount) || headcount < 1 || headcount > 50) {
      return res.status(400).json({ error: 'INVALID_HEADCOUNT' });
    }

    const session = await prisma.roomSession.findUnique({
      where: { id: sessionId },
      select: { id: true, roomId: true, status: true, tenantId: true },
    });
    if (!session) {
      return res.status(404).json({ error: 'SESSION_NOT_FOUND' });
    }
    if (session.status !== 'occupied') {
      return res.status(400).json({ error: 'SESSION_NOT_ACTIVE' });
    }

    // RBAC: operator must be assigned to this session's room (SUPER_ADMIN
    // bypasses the assignment check but is still tenant-scoped).
    if (req.admin.role !== 'SUPER_ADMIN') {
      const assignment = await prisma.roomOperatorAssignment.findFirst({
        where: { roomId: session.roomId, operatorUserId: req.admin.id },
        select: { id: true },
      });
      if (!assignment) {
        return res.status(403).json({ error: 'NOT_ASSIGNED' });
      }
    }

    const updated = await prisma.roomSession.update({
      where: { id: sessionId },
      data: { headcount },
      select: { id: true, headcount: true },
    });

    // Push ticket_updated for every active order tied to this session so the
    // headcount stepper on other counters' open cards stays in sync. We only
    // touch active tickets (pending|acknowledged) — done orders are read-only.
    try {
      const activeOrders = await prisma.order.findMany({
        where: { sessionId, status: { in: ['pending', 'acknowledged'] } },
        select: { id: true },
      });
      if (activeOrders.length) {
        const enriched = await enrichOrdersForOperator(
          activeOrders.map((o) => o.id),
          { prisma },
        );
        for (const order of enriched) {
          emitToTenant(req, order.tenantId, 'ticket_updated', order);
        }
      }
    } catch (emitErr) {
      // Never fail the PATCH because the broadcast failed.
      console.error('[operator headcount] emit failed:', emitErr);
    }

    return res.json({ session: updated });
  } catch (e) {
    next(e);
  }
});

/**
 * PATCH /api/operator/orders/:orderId/acknowledge
 *
 * Two-stage ticket flow (V4.4 §5.2). Only a `pending` order can be
 * acknowledged; the call is idempotent only in that a second attempt on an
 * already-acknowledged ticket returns 400 INVALID_STATE — by design, so a
 * second operator pressing the button sees the conflict.
 *
 * RBAC: Option C — the order's room must be assigned to the operator AND
 * the order must contain >=1 item in a category the operator owns.
 */
router.patch('/orders/:orderId/acknowledge', async (req, res, next) => {
  return transitionOrder(req, res, next, {
    from: 'pending',
    to: 'acknowledged',
    timestampField: 'acknowledgedAt',
    actorField: 'acknowledgedBy',
  });
});

/**
 * PATCH /api/operator/orders/:orderId/complete
 *
 * Strict two-stage gate: pending → acknowledged → done. We do NOT allow
 * pending -> done; the operator must explicitly acknowledge first
 * (V4.4 §5.2 / spec §9). RBAC same as /acknowledge.
 */
router.patch('/orders/:orderId/complete', async (req, res, next) => {
  return transitionOrder(req, res, next, {
    from: 'acknowledged',
    to: 'done',
    timestampField: 'completedAt',
    actorField: 'completedBy',
  });
});

async function transitionOrder(req, res, next, transition) {
  const { from, to, timestampField, actorField } = transition;
  try {
    const { orderId } = req.params;
    const allowance = await loadOperatorAllowance({
      userId: req.admin.id,
      role: req.admin.role,
    });
    if (allowance.error) {
      return res.status(allowance.error.status).json({ error: allowance.error.code });
    }
    const { allowedRoomIds, allowedCategoryIds } = allowance;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, status: true, roomId: true, acknowledgedBy: true },
    });
    if (!order) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }

    // RBAC step 1: room assignment scope.
    if (req.admin.role !== 'SUPER_ADMIN' && !allowedRoomIds.includes(order.roomId)) {
      return res.status(403).json({ error: 'NOT_ASSIGNED' });
    }

    // Enrich now: we need item categories for the Option C check + the
    // emitted payload below uses the same enrichment.
    const enrichedBefore = await enrichOrderForOperator(orderId, { prisma });
    if (!enrichedBefore) {
      return res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    }

    // RBAC step 2: Option C — must have an item in an owned category.
    if (
      req.admin.role !== 'SUPER_ADMIN' &&
      !isOrderVisible(enrichedBefore, allowedRoomIds, allowedCategoryIds)
    ) {
      return res.status(403).json({ error: 'NOT_ASSIGNED' });
    }

    if (order.status !== from) {
      return res.status(400).json({
        error: 'INVALID_STATE',
        currentStatus: order.status,
        expected: from,
        // Surfaced so the UI can show e.g. "Already acknowledged by …".
        acknowledgedBy: order.acknowledgedBy,
      });
    }

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status: to,
        [timestampField]: now,
        [actorField]: req.admin.id,
      },
    });

    const enrichedAfter = await enrichOrderForOperator(orderId, { prisma });
    if (enrichedAfter) {
      emitToTenant(req, enrichedAfter.tenantId, 'ticket_updated', enrichedAfter);
    }

    return res.json({ order: enrichedAfter });
  } catch (e) {
    next(e);
  }
}

module.exports = router;
