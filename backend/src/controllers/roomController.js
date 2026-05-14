const prisma = require('../lib/prisma');

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

const generateUniqueCode = async (base) => {
  let code = normalizeCode(base);
  for (let i = 0; i < 10; i += 1) {
    const exists = await prisma.room.findUnique({ where: { code } });
    if (!exists) return code;
    code = `${normalizeCode(base)}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${normalizeCode(base)}-${Date.now().toString(36).slice(-6)}`;
};

const listRooms = async (req, res) => {
  try {
    const rooms = await prisma.room.findMany({
      orderBy: [{ name: 'asc' }],
    });
    res.json(rooms);
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
};

const createRoom = async (req, res) => {
  try {
    const { name, code } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const finalCode = await generateUniqueCode(code || name);

    const room = await prisma.room.create({
      data: {
        name: name.trim(),
        code: finalCode,
      },
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Create room error:', error);
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Room code already exists' });
    }
    res.status(500).json({ error: 'Failed to create room' });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

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

    const room = await prisma.room.update({
      where: { id },
      data,
    });

    res.json(room);
  } catch (error) {
    console.error('Update room error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'Room code already exists' });
    }
    res.status(500).json({ error: 'Failed to update room' });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.room.delete({ where: { id } });
    res.status(204).end();
  } catch (error) {
    console.error('Delete room error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.status(500).json({ error: 'Failed to delete room' });
  }
};

module.exports = {
  listRooms,
  createRoom,
  updateRoom,
  deleteRoom,
};
