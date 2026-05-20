const express = require('express');
const prisma = require('../lib/prisma');
const { validateJwt } = require('../middleware/auth');

const router = express.Router();

router.use(validateJwt);

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

    // RBAC 1: rooms the operator is assigned to.
    const assignments = await prisma.roomOperatorAssignment.findMany({
      where: { operatorUserId: userId },
      select: { roomId: true },
    });
    const allowedRoomIds = assignments.map((a) => a.roomId);

    // RBAC 2: categories this operator is the default operator for.
    const ownedCategories = await prisma.menuCategory.findMany({
      where: {
        defaultOperatorId: userId,
        ...(role === 'SUPER_ADMIN' ? {} : { tenantId: user.tenantId }),
      },
      select: { id: true },
    });
    const allowedCategoryIds = ownedCategories.map((c) => c.id);

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

    const rawOrders = await prisma.order.findMany({
      where: { roomId: { in: allowedRoomIds }, ...statusWhere },
      select: {
        id: true,
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
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Resolve every referenced itemId -> category + localized names in one query
    // (Order.items is JSON, so this join cannot be expressed in Prisma).
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

    const allowedSet = new Set(allowedCategoryIds);

    const orders = rawOrders
      .map((o) => {
        const items = (Array.isArray(o.items) ? o.items : []).map((it) => {
          const mi = itemMap.get(it.itemId);
          return {
            itemId: it.itemId,
            qty: it.qty,
            name: it.name,
            categoryId: mi ? mi.categoryId : null,
            nameEn: mi ? mi.nameEn : it.name,
            nameTc: mi ? mi.nameTc : it.name,
            nameSc: mi ? mi.nameSc : it.name,
          };
        });
        return {
          id: o.id,
          status: o.status,
          createdAt: o.createdAt,
          acknowledgedAt: o.acknowledgedAt,
          completedAt: o.completedAt,
          sessionId: o.session ? o.session.id : null,
          headcount: o.session ? o.session.headcount : null,
          room: o.room,
          items,
        };
      })
      // Option C: keep orders containing >=1 item in the operator's categories.
      .filter((o) => o.items.some((it) => it.categoryId && allowedSet.has(it.categoryId)))
      // Tab focus: when a category is selected, keep orders that have >=1 item
      // of that category (the full order is still returned).
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

    return res.json({ session: updated });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
