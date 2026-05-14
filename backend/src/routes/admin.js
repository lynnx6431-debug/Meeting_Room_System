const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { login } = require('../controllers/authController');
const {
  API_KEY_CONFIG_KEY,
  clearApiKeyCache,
  generateApiKey,
  getExpectedApiKey,
  requireSuperAdmin,
  validateJwt,
} = require('../middleware/auth');
const { getOrders, getOrderStats, updateOrderStatus, updateAiReadyFlag } = require('../controllers/orderController');
const { listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, uploadMenuItemImage } = require('../controllers/menuController');
const { listRooms, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');
const {
  listServiceCounters,
  createServiceCounter,
  updateServiceCounter,
  deleteServiceCounter,
} = require('../controllers/serviceCounterController');

const router = express.Router();

router.post('/login', login);

router.use(validateJwt);

async function loadCurrentUser(req, res) {
  const user = await prisma.adminUser.findUnique({ where: { id: req.admin.id } });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: User not found' });
    return null;
  }
  return user;
}

router.get('/me', async (req, res) => {
  try {
    const user = await loadCurrentUser(req, res);
    if (!user) return;
    return res.json({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.patch('/me/password', async (req, res) => {
  try {
    const user = await loadCurrentUser(req, res);
    if (!user) return;

    const { currentPassword, newPassword } = req.body || {};
    const cur = String(currentPassword || '');
    const next = String(newPassword || '');

    if (!cur || !next || next.length < 6) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    const ok = await bcrypt.compare(cur, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const passwordHash = await bcrypt.hash(next, 10);
    await prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

router.get('/config/api-key', requireSuperAdmin, async (req, res) => {
  try {
    const apiKey = await getExpectedApiKey();
    return res.json({ apiKey: apiKey || '' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load API key' });
  }
});

router.put('/config/api-key', requireSuperAdmin, async (req, res) => {
  try {
    const { apiKey } = req.body || {};
    const next = String(apiKey || '').trim();
    if (!next || next.length < 12) {
      return res.status(400).json({ error: 'Invalid apiKey' });
    }

    await prisma.systemConfig.upsert({
      where: { key: API_KEY_CONFIG_KEY },
      update: { value: next },
      create: { key: API_KEY_CONFIG_KEY, value: next },
    });
    clearApiKeyCache();
    return res.json({ apiKey: next });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update API key' });
  }
});

router.post('/config/api-key/reset', requireSuperAdmin, async (req, res) => {
  try {
    const next = generateApiKey();
    await prisma.systemConfig.upsert({
      where: { key: API_KEY_CONFIG_KEY },
      update: { value: next },
      create: { key: API_KEY_CONFIG_KEY, value: next },
    });
    clearApiKeyCache();
    return res.json({ apiKey: next });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to reset API key' });
  }
});

async function countSuperAdmins() {
  return prisma.adminUser.count({ where: { role: 'SUPER_ADMIN' } });
}

async function ensureNotLastSuperAdmin(targetUserId, nextRoleIfChanging) {
  const target = await prisma.adminUser.findUnique({ where: { id: targetUserId } });
  if (!target) {
    const err = new Error('NOT_FOUND');
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isSuper = target.role === 'SUPER_ADMIN';
  const willStaySuper = nextRoleIfChanging ? nextRoleIfChanging === 'SUPER_ADMIN' : isSuper;
  if (!isSuper || willStaySuper) return;

  const superCount = await countSuperAdmins();
  if (superCount <= 1) {
    const err = new Error('LAST_SUPER_ADMIN');
    err.code = 'LAST_SUPER_ADMIN';
    throw err;
  }
}

router.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, role: true, createdAt: true, updatedAt: true },
    });
    return res.json(users);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', requireSuperAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body || {};
    const u = String(username || '').trim();
    const p = String(password || '');
    const r = role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    if (!u || !p || p.length < 6) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const passwordHash = await bcrypt.hash(p, 10);
    const user = await prisma.adminUser.create({
      data: { username: u, passwordHash, role: r },
      select: { id: true, username: true, role: true, createdAt: true, updatedAt: true },
    });
    return res.status(201).json(user);
  } catch (e) {
    if (String(e.code || '') === 'P2002') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role } = req.body || {};

    const nextRole = role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : role === 'ADMIN' ? 'ADMIN' : undefined;
    if (nextRole) {
      await ensureNotLastSuperAdmin(id, nextRole);
    }

    const data = {};
    if (typeof password === 'string' && password.trim() && password.length >= 6) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }
    if (nextRole) {
      data.role = nextRole;
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'No changes' });
    }

    const user = await prisma.adminUser.update({
      where: { id },
      data,
      select: { id: true, username: true, role: true, createdAt: true, updatedAt: true },
    });
    return res.json(user);
  } catch (e) {
    if (e.code === 'NOT_FOUND' || String(e.code || '') === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (e.code === 'LAST_SUPER_ADMIN') {
      return res.status(409).json({ error: 'Cannot remove the last SUPER_ADMIN' });
    }
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await ensureNotLastSuperAdmin(id, 'ADMIN');
    await prisma.adminUser.delete({ where: { id } });
    return res.status(204).send();
  } catch (e) {
    if (e.code === 'NOT_FOUND' || String(e.code || '') === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    if (e.code === 'LAST_SUPER_ADMIN') {
      return res.status(409).json({ error: 'Cannot delete the last SUPER_ADMIN' });
    }
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.get('/orders/stats', getOrderStats);
router.get('/orders', getOrders);
router.patch('/orders/:id/status', updateOrderStatus);
router.patch('/orders/:id/ai-ready', updateAiReadyFlag);

router.get('/menu', listMenuItems);
router.post('/menu', createMenuItem);
router.patch('/menu/:id', updateMenuItem);
router.post('/menu/:id/image', uploadMenuItemImage);
router.delete('/menu/:id', deleteMenuItem);

router.get('/rooms', listRooms);
router.post('/rooms', createRoom);
router.patch('/rooms/:id', updateRoom);
router.delete('/rooms/:id', deleteRoom);

router.get('/service-counters', listServiceCounters);
router.post('/service-counters', createServiceCounter);
router.patch('/service-counters/:id', updateServiceCounter);
router.delete('/service-counters/:id', deleteServiceCounter);

router.get('/categories', async (req, res) => {
  try {
    const list = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameZh: true,
        nameEn: true,
        nameHant: true,
        imageUrl: true,
        serviceCounterId: true,
        serviceCounter: { select: { id: true, name: true, nameZh: true, nameEn: true, nameHant: true } },
      },
    });
    return res.json(list);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list categories' });
  }
});

router.post('/categories', async (req, res) => {
  try {
    const { name, nameZh, nameEn, nameHant } = req.body || {};
    const key = String(name || '').trim();
    if (!key) return res.status(400).json({ error: 'name is required' });

    const normalize = (v) => {
      if (v == null) return undefined;
      const s = String(v).trim();
      return s ? s : undefined;
    };

    const zh = normalize(nameZh) ?? key;
    const en = normalize(nameEn);
    const hant = normalize(nameHant);

    const created = await prisma.category.create({
      data: { name: key, nameZh: zh, nameEn: en, nameHant: hant },
    });
    return res.status(201).json(created);
  } catch (e) {
    if (String(e.code || '') === 'P2002') return res.status(409).json({ error: 'Category already exists' });
    return res.status(500).json({ error: 'Failed to create category' });
  }
});

router.patch('/categories/:id', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const normalize = (v) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      const s = String(v).trim();
      return s ? s : null;
    };

    const { nameZh, nameEn, nameHant } = req.body || {};
    const data = {};
    const nz = normalize(nameZh);
    const ne = normalize(nameEn);
    const nh = normalize(nameHant);
    if (nz !== undefined) data.nameZh = nz;
    if (ne !== undefined) data.nameEn = ne;
    if (nh !== undefined) data.nameHant = nh;

    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'No changes' });
    }

    const updated = await prisma.category.update({ where: { id }, data });
    return res.json(updated);
  } catch (e) {
    if (String(e.code || '') === 'P2025') return res.status(404).json({ error: 'Category not found' });
    return res.status(500).json({ error: 'Failed to update category' });
  }
});

function resolveUploadsDir() {
  return path.join(__dirname, '..', '..', 'uploads');
}

function parseImageDataUrl(dataUrl) {
  const s = String(dataUrl || '').trim();
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(s);
  if (!m) return null;
  return { mime: m[1].toLowerCase(), base64: m[2] };
}

router.post('/categories/:id/image', async (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    const { dataUrl } = req.body || {};

    const parsed = parseImageDataUrl(dataUrl);
    if (!parsed) {
      return res.status(400).json({ error: 'Invalid image payload' });
    }
    if (parsed.mime !== 'image/png') {
      return res.status(400).json({ error: 'Only PNG is supported' });
    }

    const buf = Buffer.from(parsed.base64, 'base64');
    if (!buf.length) {
      return res.status(400).json({ error: 'Empty image' });
    }

    const uploadsDir = resolveUploadsDir();
    const subDir = path.join(uploadsDir, 'category-icons');
    fs.mkdirSync(subDir, { recursive: true });

    const filename = `${id}-${Date.now()}.png`;
    const abs = path.join(subDir, filename);
    fs.writeFileSync(abs, buf);

    const imageUrl = `/uploads/category-icons/${filename}`;
    const updated = await prisma.category.update({
      where: { id },
      data: { imageUrl },
    });

    return res.json({ imageUrl: updated.imageUrl });
  } catch (e) {
    if (String(e.code || '') === 'P2025') return res.status(404).json({ error: 'Category not found' });
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
