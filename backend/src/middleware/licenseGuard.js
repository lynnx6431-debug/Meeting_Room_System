const prisma = require('../lib/prisma');

async function licenseGuard(req, res, next) {
  try {
    if (!req.ctx) return next();
    if (req.ctx.role === 'SUPER_ADMIN') return next();
    if (req.method === 'GET') return next();

    const tenantId = req.ctx.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'TENANT_MISSING' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true, licenseExpiry: true },
    });

    if (!tenant) {
      return res.status(403).json({ error: 'TENANT_NOT_FOUND' });
    }
    if (tenant.status !== 'active') {
      return res.status(403).json({ error: 'TENANT_SUSPENDED', status: tenant.status });
    }
    if (tenant.licenseExpiry && tenant.licenseExpiry < new Date()) {
      return res.status(403).json({
        error: 'LICENSE_EXPIRED',
        expiredAt: tenant.licenseExpiry,
      });
    }

    const isCreateRoom = req.method === 'POST' && /\/rooms\/?$/.test(req.path);
    if (isCreateRoom) {
      const siteId = req.body?.siteId;
      if (!siteId) {
        return res.status(400).json({ error: 'SITE_ID_REQUIRED' });
      }

      const license = await prisma.license.findFirst({
        where: { tenantId, siteId },
        select: { id: true, roomLimit: true },
      });
      if (!license) {
        return res.status(403).json({ error: 'NO_LICENSE_FOR_SITE', siteId });
      }

      const roomCount = await prisma.room.count({
        where: { tenantId, siteId },
      });
      if (roomCount >= license.roomLimit) {
        return res.status(403).json({
          error: 'ROOM_LIMIT_REACHED',
          limit: license.roomLimit,
          current: roomCount,
        });
      }
    }

    return next();
  } catch (e) {
    console.error('License guard failed:', e);
    return res.status(500).json({ error: 'License guard failed' });
  }
}

module.exports = { licenseGuard };
