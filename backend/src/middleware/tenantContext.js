const { runWithContext } = require('../lib/tenantContext');
const prisma = require('../lib/prisma');

async function tenantContextMiddleware(req, res, next) {
  try {
    if (!req.admin || !req.admin.id) {
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: req.admin.id },
      select: { id: true, tenantId: true, role: true, status: true },
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Unauthorized: user inactive' });
    }

    const ctx = {
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId,
    };

    req.ctx = ctx;
    return runWithContext(ctx, () => next());
  } catch (e) {
    console.error('Tenant context failed:', e);
    return res.status(500).json({ error: 'Tenant context failed' });
  }
}

module.exports = { tenantContextMiddleware };
