const express = require('express');
const prisma = require('../lib/prisma');

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

module.exports = router;
