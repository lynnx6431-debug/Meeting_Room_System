const express = require('express');
const prisma = require('../lib/prisma');
const { resetSession } = require('../services/roomSession');

const router = express.Router();

/**
 * DEV ONLY. Returns all rooms with their tokens so frontend dev tooling can
 * provide a quick-launch UI.
 *
 * Never expose in production - it leaks all room_tokens of all tenants.
 */
router.get('/demo-rooms', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).end();
  }

  const rooms = await prisma.room.findMany({
    select: {
      code: true,
      name: true,
      nameEn: true,
      roomToken: true,
    },
    orderBy: [{ siteId: 'asc' }, { code: 'asc' }],
  });

  return res.json({
    rooms: rooms.map((room) => ({
      code: room.code,
      name: room.nameEn || room.name,
      token: room.roomToken,
    })),
  });
});

/**
 * DEV ONLY. Resets the active session for the room identified by the given
 * room token (occupied -> vacant), so the full guest flow (headcount ->
 * menu -> order) can be re-tested repeatedly without an admin/counter.
 *
 * Never expose in production.
 */
router.post('/reset-session', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).end();
  }

  const token = String(req.body?.token || '').trim();
  if (!token) {
    return res.status(400).json({ error: 'TOKEN_REQUIRED' });
  }

  const room = await prisma.room.findFirst({
    where: { roomToken: token },
    select: { id: true, tenantId: true, code: true },
  });
  if (!room) {
    return res.status(404).json({ error: 'ROOM_NOT_FOUND' });
  }

  const count = await resetSession({
    tenantId: room.tenantId,
    roomId: room.id,
    resetBy: 'dev-reset',
  });

  return res.json({ ok: true, room: room.code, sessionsReset: count });
});

module.exports = router;
