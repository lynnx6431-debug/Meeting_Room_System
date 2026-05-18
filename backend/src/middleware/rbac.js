const prisma = require('../lib/prisma');

function requireRole(allowedRoles) {
  return function roleGate(req, res, next) {
    if (!req.ctx || !req.ctx.role) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }
    if (!allowedRoles.includes(req.ctx.role)) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        requiredRoles: allowedRoles,
        actualRole: req.ctx.role,
      });
    }
    return next();
  };
}

function requireOperatorSiteAccess(siteIdGetter) {
  return async function operatorSiteGate(req, res, next) {
    try {
      if (!req.ctx) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }
      if (req.ctx.role !== 'OPERATOR') {
        return next();
      }

      const siteId = await siteIdGetter(req);
      if (!siteId) {
        return res.status(400).json({ error: 'SITE_ID_MISSING_FOR_OPERATOR_CHECK' });
      }

      const usa = await prisma.userSiteAssignment.findFirst({
        where: {
          userId: req.ctx.userId,
          siteId,
        },
      });
      if (!usa) {
        return res.status(403).json({
          error: 'OPERATOR_NOT_IN_SITE',
          siteId,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function requireOperatorRoomAccess(roomIdGetter) {
  return async function operatorRoomGate(req, res, next) {
    try {
      if (!req.ctx) {
        return res.status(401).json({ error: 'UNAUTHENTICATED' });
      }
      if (req.ctx.role !== 'OPERATOR') {
        return next();
      }

      const roomId = await roomIdGetter(req);
      if (!roomId) {
        return res.status(400).json({ error: 'ROOM_ID_MISSING_FOR_OPERATOR_CHECK' });
      }

      const assignment = await prisma.roomOperatorAssignment.findFirst({
        where: {
          roomId,
          operatorUserId: req.ctx.userId,
        },
      });
      if (!assignment) {
        return res.status(403).json({
          error: 'OPERATOR_NOT_ASSIGNED_TO_ROOM',
          roomId,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = {
  requireRole,
  requireOperatorSiteAccess,
  requireOperatorRoomAccess,
};
