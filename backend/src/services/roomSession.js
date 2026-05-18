const prisma = require('../lib/prisma');

async function createSession({ tenantId, siteId, roomId, headcount }) {
  if (!Number.isInteger(headcount) || headcount < 1) {
    const err = new Error('INVALID_HEADCOUNT');
    err.code = 'INVALID_HEADCOUNT';
    throw err;
  }

  try {
    const session = await prisma.roomSession.create({
      data: { tenantId, siteId, roomId, headcount, status: 'occupied' },
    });
    return session;
  } catch (e) {
    if (e.code === 'P2002') {
      const err = new Error('ROOM_ALREADY_OCCUPIED');
      err.code = 'ROOM_ALREADY_OCCUPIED';
      throw err;
    }
    throw e;
  }
}

async function getActiveSession({ tenantId, roomId }) {
  return prisma.roomSession.findFirst({
    where: { tenantId, roomId, status: 'occupied' },
  });
}

async function resetSession({ tenantId, roomId, resetBy }) {
  const result = await prisma.roomSession.updateMany({
    where: { tenantId, roomId, status: 'occupied' },
    data: {
      status: 'vacant',
      resetAt: new Date(),
      resetBy,
      closedAt: new Date(),
    },
  });
  return result.count;
}

async function overrideHeadcount({ tenantId, roomId, newHeadcount }) {
  if (!Number.isInteger(newHeadcount) || newHeadcount < 1) {
    const err = new Error('INVALID_HEADCOUNT');
    err.code = 'INVALID_HEADCOUNT';
    throw err;
  }

  const active = await getActiveSession({ tenantId, roomId });
  if (!active) {
    const err = new Error('NO_ACTIVE_SESSION');
    err.code = 'NO_ACTIVE_SESSION';
    throw err;
  }

  return prisma.roomSession.update({
    where: { id: active.id },
    data: { headcount: newHeadcount },
  });
}

module.exports = {
  createSession,
  getActiveSession,
  resetSession,
  overrideHeadcount,
};
