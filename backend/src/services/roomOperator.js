const prisma = require('../lib/prisma');

async function ensureSiteBelongsToTenant({ tenantId, siteId }) {
  if (!siteId) {
    const err = new Error('SITE_ID_REQUIRED');
    err.code = 'SITE_ID_REQUIRED';
    throw err;
  }

  const site = await prisma.site.findFirst({
    where: tenantId ? { id: siteId, tenantId } : { id: siteId },
    select: { id: true, name: true, tenantId: true },
  });
  if (!site) {
    const err = new Error('SITE_NOT_FOUND');
    err.code = 'SITE_NOT_FOUND';
    throw err;
  }

  return site;
}

async function loadAndValidate({ tenantId, siteId, roomId, operatorUserId }) {
  const [room, operator] = await Promise.all([
    prisma.room.findFirst({
      where: tenantId ? { id: roomId, tenantId } : { id: roomId },
      select: { id: true, tenantId: true, siteId: true, name: true },
    }),
    prisma.user.findFirst({
      where: {
        id: operatorUserId,
        ...(tenantId ? { tenantId } : {}),
        role: 'OPERATOR',
      },
      select: { id: true, tenantId: true, username: true, email: true },
    }),
  ]);

  if (!room) {
    const err = new Error('ROOM_NOT_FOUND');
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  if (!operator) {
    const err = new Error('OPERATOR_NOT_FOUND');
    err.code = 'OPERATOR_NOT_FOUND';
    throw err;
  }
  if (room.tenantId !== operator.tenantId) {
    const err = new Error('OPERATOR_NOT_FOUND');
    err.code = 'OPERATOR_NOT_FOUND';
    throw err;
  }
  if (siteId && room.siteId !== siteId) {
    const err = new Error('ROOM_SITE_MISMATCH');
    err.code = 'ROOM_SITE_MISMATCH';
    throw err;
  }

  const usa = await prisma.userSiteAssignment.findFirst({
    where: {
      userId: operator.id,
      siteId: room.siteId,
    },
    select: { userId: true, siteId: true },
  });
  if (!usa) {
    const err = new Error('OPERATOR_NOT_IN_SITE');
    err.code = 'OPERATOR_NOT_IN_SITE';
    throw err;
  }

  return { room, operator };
}

async function listAssignments({ tenantId, siteId }) {
  let effectiveTenantId = tenantId || null;
  if (siteId) {
    const site = await ensureSiteBelongsToTenant({ tenantId, siteId });
    effectiveTenantId = effectiveTenantId || site.tenantId;
  }

  return prisma.roomOperatorAssignment.findMany({
    where: {
      ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
      ...(siteId ? { siteId } : {}),
    },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameTc: true,
          nameSc: true,
        },
      },
      operator: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
    orderBy: [{ siteId: 'asc' }, { roomId: 'asc' }, { operatorUserId: 'asc' }],
  });
}

async function getMatrix({ tenantId, siteId }) {
  const site = await ensureSiteBelongsToTenant({ tenantId, siteId });
  const effectiveTenantId = tenantId || site.tenantId;

  const [rooms, operatorAssignments, assignments] = await Promise.all([
    prisma.room.findMany({
      where: { tenantId: effectiveTenantId, siteId },
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameTc: true,
        nameSc: true,
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.userSiteAssignment.findMany({
      where: {
        siteId,
        user: {
          tenantId: effectiveTenantId,
          role: 'OPERATOR',
          status: 'active',
        },
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: [{ userId: 'asc' }],
    }),
    prisma.roomOperatorAssignment.findMany({
      where: { tenantId: effectiveTenantId, siteId },
      select: { roomId: true, operatorUserId: true },
      orderBy: [{ roomId: 'asc' }, { operatorUserId: 'asc' }],
    }),
  ]);

  const operators = operatorAssignments
    .map((assignment) => assignment.user)
    .sort((left, right) => {
      const a = String(left.username || left.email || left.id || '');
      const b = String(right.username || right.email || right.id || '');
      return a.localeCompare(b);
    });

  return {
    siteId,
    siteName: site.name,
    rooms,
    operators,
    assignments,
  };
}

async function createAssignment({ tenantId, roomId, operatorUserId }) {
  const { room } = await loadAndValidate({ tenantId, roomId, operatorUserId });
  const effectiveTenantId = tenantId || room.tenantId;

  try {
    return await prisma.roomOperatorAssignment.create({
      data: {
        tenantId: effectiveTenantId,
        siteId: room.siteId,
        roomId,
        operatorUserId,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      const err = new Error('ASSIGNMENT_EXISTS');
      err.code = 'ASSIGNMENT_EXISTS';
      throw err;
    }
    throw error;
  }
}

async function deleteAssignment({ tenantId, roomId, operatorUserId }) {
  const result = await prisma.roomOperatorAssignment.deleteMany({
    where: {
      ...(tenantId ? { tenantId } : {}),
      roomId,
      operatorUserId,
    },
  });

  if (result.count === 0) {
    const err = new Error('ASSIGNMENT_NOT_FOUND');
    err.code = 'ASSIGNMENT_NOT_FOUND';
    throw err;
  }

  return result;
}

async function replaceMatrix({ tenantId, siteId, desired }) {
  const site = await ensureSiteBelongsToTenant({ tenantId, siteId });
  const effectiveTenantId = tenantId || site.tenantId;

  if (!Array.isArray(desired)) {
    const err = new Error('DESIRED_MUST_BE_ARRAY');
    err.code = 'DESIRED_MUST_BE_ARRAY';
    throw err;
  }

  const seen = new Set();
  const dedupedDesired = [];

  for (const item of desired) {
    if (!item || !item.roomId || !item.operatorUserId) {
      const err = new Error('INVALID_ASSIGNMENT_PAIR');
      err.code = 'INVALID_ASSIGNMENT_PAIR';
      throw err;
    }
    const key = `${item.roomId}:${item.operatorUserId}`;
    if (!seen.has(key)) {
      seen.add(key);
      dedupedDesired.push({
        roomId: item.roomId,
        operatorUserId: item.operatorUserId,
      });
    }
  }

  for (const pair of dedupedDesired) {
    await loadAndValidate({
      tenantId: effectiveTenantId,
      siteId,
      roomId: pair.roomId,
      operatorUserId: pair.operatorUserId,
    });
  }

  return prisma.$transaction(async (tx) => {
    const current = await tx.roomOperatorAssignment.findMany({
      where: { tenantId: effectiveTenantId, siteId },
      select: { roomId: true, operatorUserId: true },
    });

    const currentKeys = new Set(current.map((item) => `${item.roomId}:${item.operatorUserId}`));
    const desiredKeys = new Set(dedupedDesired.map((item) => `${item.roomId}:${item.operatorUserId}`));

    const toAdd = dedupedDesired.filter((item) => !currentKeys.has(`${item.roomId}:${item.operatorUserId}`));
    const toRemove = current.filter((item) => !desiredKeys.has(`${item.roomId}:${item.operatorUserId}`));

    if (toAdd.length > 0) {
      await tx.roomOperatorAssignment.createMany({
        data: toAdd.map((item) => ({
          tenantId: effectiveTenantId,
          siteId,
          roomId: item.roomId,
          operatorUserId: item.operatorUserId,
        })),
        skipDuplicates: true,
      });
    }

    if (toRemove.length > 0) {
      await tx.roomOperatorAssignment.deleteMany({
        where: {
          tenantId: effectiveTenantId,
          siteId,
          OR: toRemove.map((item) => ({
            roomId: item.roomId,
            operatorUserId: item.operatorUserId,
          })),
        },
      });
    }

    return {
      added: toAdd.length,
      removed: toRemove.length,
    };
  });
}

async function listMyAssignments({ tenantId, userId }) {
  return prisma.roomOperatorAssignment.findMany({
    where: {
      tenantId,
      operatorUserId: userId,
    },
    include: {
      room: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameTc: true,
          nameSc: true,
          siteId: true,
        },
      },
    },
    orderBy: [{ roomId: 'asc' }],
  });
}

module.exports = {
  listAssignments,
  getMatrix,
  createAssignment,
  deleteAssignment,
  replaceMatrix,
  listMyAssignments,
};
