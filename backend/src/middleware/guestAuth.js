const prisma = require('../lib/prisma');

async function guestAuthMiddleware(req, res, next) {
  try {
    const headerToken = typeof req.headers['x-room-token'] === 'string' ? req.headers['x-room-token'].trim() : '';
    const queryToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const token = headerToken || queryToken;

    if (!token) {
      return res.status(401).json({ error: 'ROOM_TOKEN_MISSING' });
    }

    const room = await prisma.room.findUnique({
      where: { roomToken: token },
      include: {
        site: {
          select: {
            id: true,
            name: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            status: true,
            licenseExpiry: true,
          },
        },
      },
    });

    if (!room) {
      return res.status(401).json({ error: 'INVALID_ROOM_TOKEN' });
    }

    req.guestCtx = {
      roomId: room.id,
      siteId: room.siteId,
      tenantId: room.tenantId,
      roomToken: room.roomToken,
      room,
      tenantStatus: room.tenant.status,
      licenseExpiry: room.tenant.licenseExpiry,
    };

    return next();
  } catch (error) {
    return next(error);
  }
}

function guestStateGuard(req, res, next) {
  if (!req.guestCtx) {
    return res.status(401).json({ error: 'GUEST_CONTEXT_MISSING' });
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    return next();
  }

  if (req.guestCtx.tenantStatus !== 'active') {
    return res.status(403).json({
      error: 'TENANT_SUSPENDED',
      status: req.guestCtx.tenantStatus,
    });
  }

  if (req.guestCtx.licenseExpiry && req.guestCtx.licenseExpiry < new Date()) {
    return res.status(403).json({
      error: 'LICENSE_EXPIRED',
      expiredAt: req.guestCtx.licenseExpiry,
    });
  }

  return next();
}

module.exports = {
  guestAuthMiddleware,
  guestStateGuard,
};
