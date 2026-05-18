const prisma = require('../lib/prismaWithTenant');
const {
  createSession,
  getActiveSession,
  resetSession,
  overrideHeadcount,
} = require('../services/roomSession');

async function loadScopedRoom(roomId) {
  return prisma.room.findUnique({ where: { id: roomId } });
}

function resolveTenantId(req, room) {
  return req.ctx?.tenantId || room.tenantId;
}

async function getRoomSession(req, res) {
  const room = await loadScopedRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const session = await getActiveSession({
    tenantId: resolveTenantId(req, room),
    roomId: room.id,
  });

  return res.json(session || null);
}

async function createRoomSession(req, res) {
  const room = await loadScopedRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  try {
    const session = await createSession({
      tenantId: resolveTenantId(req, room),
      siteId: room.siteId,
      roomId: room.id,
      headcount: Number(req.body?.headcount),
    });
    return res.status(201).json(session);
  } catch (e) {
    if (e.code === 'ROOM_ALREADY_OCCUPIED') return res.status(409).json({ error: e.code });
    if (e.code === 'INVALID_HEADCOUNT') return res.status(400).json({ error: e.code });
    throw e;
  }
}

async function resetRoomSession(req, res) {
  const room = await loadScopedRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const resetCount = await resetSession({
    tenantId: resolveTenantId(req, room),
    roomId: room.id,
    resetBy: req.ctx?.userId || null,
  });

  return res.json({ resetCount });
}

async function overrideRoomHeadcount(req, res) {
  const room = await loadScopedRoom(req.params.id);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  try {
    const updated = await overrideHeadcount({
      tenantId: resolveTenantId(req, room),
      roomId: room.id,
      newHeadcount: Number(req.body?.headcount),
    });
    return res.json(updated);
  } catch (e) {
    if (e.code === 'NO_ACTIVE_SESSION' || e.code === 'INVALID_HEADCOUNT') {
      return res.status(400).json({ error: e.code });
    }
    throw e;
  }
}

module.exports = {
  getRoomSession,
  createRoomSession,
  resetRoomSession,
  overrideRoomHeadcount,
};
