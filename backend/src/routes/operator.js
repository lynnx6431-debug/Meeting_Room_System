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

module.exports = router;
