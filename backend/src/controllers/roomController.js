const prisma = require('../lib/prismaWithTenant');
const basePrisma = require('../lib/prisma');

const normalizeCode = (code) => {
  const cleaned = String(code)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || `room-${Math.random().toString(36).slice(2, 8)}`;
};

const generateUniqueCode = async (base, siteId) => {
  let code = normalizeCode(base);
  for (let i = 0; i < 10; i += 1) {
    const exists = await prisma.room.findFirst({ where: { siteId, code } });
    if (!exists) return code;
    code = `${normalizeCode(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${normalizeCode(base)}-${Date.now().toString(36).slice(-6)}`;
};

const listRooms = async (req, res) => {
  try {
    let where = {};

    if (req.ctx?.role === 'OPERATOR') {
      const siteAssignments = await basePrisma.userSiteAssignment.findMany({
        where: { userId: req.ctx.userId },
        select: { siteId: true },
      });
      const allowedSiteIds = [...new Set(siteAssignments.map((assignment) => assignment.siteId))];
      where = {
        siteId: {
          in: allowedSiteIds,
        },
      };
    }

    const rooms = await prisma.room.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });
    res.json(rooms);
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
};

const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;
    const room = await prisma.room.findUnique({ where: { id } });
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    return res.json(room);
  } catch (error) {
    console.error('Get room error:', error);
    return res.status(500).json({ error: 'Failed to get room' });
  }
};

function handleRoomControllerError(error, next, fallbackMessage) {
  if (error.code === 'NOT_FOUND_OR_FORBIDDEN' || error.code === 'TENANT_MISMATCH') {
    return next(error);
  }
  if (error.code === 'P2025') {
    return { status: 404, body: { error: 'Room not found' } };
  }
  if (error.code === 'P2002') {
    return { status: 409, body: { error: 'Room code already exists' } };
  }
  return { status: 500, body: { error: fallbackMessage } };
}

const createRoom = async (req, res, next) => {
  try {
    const { tenantId, siteId, name, code, nameEn, nameTc, nameSc, menuId } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!siteId || typeof siteId !== 'string' || !siteId.trim()) {
      return res.status(400).json({ error: 'siteId is required' });
    }

    const site = await basePrisma.site.findUnique({
      where: { id: siteId.trim() },
      select: { id: true, tenantId: true },
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    const effectiveTenantId =
      (typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : null) ||
      req.ctx?.tenantId ||
      site.tenantId;

    if (!effectiveTenantId) {
      return res.status(400).json({ error: 'tenantId is required' });
    }

    const finalCode = await generateUniqueCode(code || name, siteId.trim());

    const room = await prisma.room.create({
      data: {
        tenantId: effectiveTenantId,
        siteId: siteId.trim(),
        name: name.trim(),
        code: finalCode,
        nameEn: typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : undefined,
        nameTc: typeof nameTc === 'string' && nameTc.trim() ? nameTc.trim() : undefined,
        nameSc: typeof nameSc === 'string' && nameSc.trim() ? nameSc.trim() : undefined,
        menuId: typeof menuId === 'string' && menuId.trim() ? menuId.trim() : undefined,
      },
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    const handled = handleRoomControllerError(error, next, 'Failed to create room');
    if (handled) return res.status(handled.status).json(handled.body);
  }
};

const updateRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code, tenantId, siteId, nameEn, nameTc, nameSc, menuId } = req.body || {};

    const data = {};
    if (name != null) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      data.name = name.trim();
    }
    if (code != null) {
      if (typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'code must be a non-empty string' });
      }
      data.code = normalizeCode(code);
    }
    if (tenantId != null) {
      if (typeof tenantId !== 'string' || !tenantId.trim()) {
        return res.status(400).json({ error: 'tenantId must be a non-empty string' });
      }
      data.tenantId = tenantId.trim();
    }
    if (siteId != null) {
      if (typeof siteId !== 'string' || !siteId.trim()) {
        return res.status(400).json({ error: 'siteId must be a non-empty string' });
      }
      data.siteId = siteId.trim();
    }
    if (nameEn !== undefined) data.nameEn = typeof nameEn === 'string' && nameEn.trim() ? nameEn.trim() : null;
    if (nameTc !== undefined) data.nameTc = typeof nameTc === 'string' && nameTc.trim() ? nameTc.trim() : null;
    if (nameSc !== undefined) data.nameSc = typeof nameSc === 'string' && nameSc.trim() ? nameSc.trim() : null;
    if (menuId !== undefined) data.menuId = typeof menuId === 'string' && menuId.trim() ? menuId.trim() : null;

    const room = await prisma.room.update({
      where: { id },
      data,
    });

    res.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    const handled = handleRoomControllerError(error, next, 'Failed to update room');
    if (handled) return res.status(handled.status).json(handled.body);
  }
};

const deleteRoom = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.room.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Delete room error:', error);
    const handled = handleRoomControllerError(error, next, 'Failed to delete room');
    if (handled) return res.status(handled.status).json(handled.body);
  }
};

module.exports = {
  listRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
};
