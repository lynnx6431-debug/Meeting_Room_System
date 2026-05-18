const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prismaWithTenant');
const { login, refresh, logout } = require('../controllers/authController');
const { postInvite, getInvite, activate } = require('../controllers/inviteController');
const roomOperatorController = require('../controllers/roomOperatorController');
const { tenantContextMiddleware } = require('../middleware/tenantContext');
const { licenseGuard } = require('../middleware/licenseGuard');
const { requireRole, requireOperatorRoomAccess } = require('../middleware/rbac');
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
const { listRooms, getRoomById, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');
const roomSessionsRouter = require('./roomSessions');
const {
  listServiceCounters,
  createServiceCounter,
  updateServiceCounter,
  deleteServiceCounter,
} = require('../controllers/serviceCounterController');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const respondCompatDisabled = (feature, todo) => (req, res) =>
  res.status(503).json({
    error: `${feature} is temporarily disabled in V4 compatibility mode`,
    code: 'E1_V4_COMPAT_DISABLED',
    feature,
    todo,
  });

const normalizeUserRole = (role) => {
  if (role === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (role === 'CUSTOMER_ADMIN' || role === 'ADMIN') return 'CUSTOMER_ADMIN';
  if (role === 'OPERATOR') return 'OPERATOR';
  return undefined;
};

router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/invites/:token', asyncHandler(getInvite));
router.post('/invites/:token/activate', asyncHandler(activate));

router.use(validateJwt);
router.use(tenantContextMiddleware);
router.use(licenseGuard);

router.post('/invites', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(postInvite));
router.get('/me/assignments', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), asyncHandler(roomOperatorController.mySelf));
router.get('/assignments', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(roomOperatorController.list));
router.get('/assignments/matrix', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(roomOperatorController.matrix));
router.post('/assignments', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(roomOperatorController.create));
router.delete('/assignments/:roomId/:operatorUserId', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(roomOperatorController.remove));
router.put('/assignments/matrix', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(roomOperatorController.putMatrix));

async function loadCurrentUser(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.admin.id } });
  if (!user) {
    res.status(401).json({ error: 'Unauthorized: User not found' });
    return null;
  }
  return user;
}

router.get('/me', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const user = await loadCurrentUser(req, res);
    if (!user) return;
    return res.json({ id: user.id, username: user.username, email: user.email, role: user.role, status: user.status });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.patch('/me/password', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), async (req, res) => {
  try {
    const user = await loadCurrentUser(req, res);
    if (!user) return;

    const { currentPassword, newPassword } = req.body || {};
    const cur = String(currentPassword || '');
    const next = String(newPassword || '');

    if (!cur || !next || next.length < 6) {
      return res.status(400).json({ error: 'Invalid password' });
    }
    if (!user.passwordHash) {
      return res.status(409).json({ error: 'Password login is not enabled for this user' });
    }

    const ok = await bcrypt.compare(cur, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const passwordHash = await bcrypt.hash(next, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update password' });
  }
});

router.get('/config/api-key', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
  try {
    const apiKey = await getExpectedApiKey();
    return res.json({ apiKey: apiKey || '' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load API key' });
  }
});

router.put('/config/api-key', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
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

router.post('/config/api-key/reset', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
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
  return prisma.user.count({ where: { role: 'SUPER_ADMIN' } });
}

async function ensureNotLastSuperAdmin(targetUserId, nextRoleIfChanging) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
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

router.get('/users', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
    return res.json(users);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
  try {
    const { username, email, password, role } = req.body || {};
    const u = String(username || '').trim();
    const em = typeof email === 'string' && email.trim() ? email.trim() : null;
    const p = String(password || '');
    const r = normalizeUserRole(role);

    if ((!u && !em) || !p || p.length < 6 || !r) {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const passwordHash = await bcrypt.hash(p, 10);
    const user = await prisma.user.create({
      data: { username: u || null, email: em, passwordHash, role: r, status: 'active', tenantId: null },
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
    });
    return res.status(201).json(user);
  } catch (e) {
    if (String(e.code || '') === 'P2002') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role, email, username, status } = req.body || {};

    const nextRole = normalizeUserRole(role);
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
    if (username !== undefined) {
      const nextUsername = String(username || '').trim();
      data.username = nextUsername || null;
    }
    if (email !== undefined) {
      const nextEmail = String(email || '').trim();
      data.email = nextEmail || null;
    }
    if (status === 'active' || status === 'invited' || status === 'disabled') {
      data.status = status;
    }
    if (!Object.keys(data).length) {
      return res.status(400).json({ error: 'No changes' });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
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

router.delete('/users/:id', requireRole(['SUPER_ADMIN']), requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await ensureNotLastSuperAdmin(id, 'CUSTOMER_ADMIN');
    await prisma.user.delete({ where: { id } });
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

router.get('/orders/stats', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), getOrderStats);
router.get('/orders', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), getOrders);
router.patch(
  '/orders/:id/status',
  requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']),
  requireOperatorRoomAccess(async (req) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { roomId: true },
    });
    return order?.roomId;
  }),
  updateOrderStatus,
);
router.patch(
  '/orders/:id/ai-ready',
  requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']),
  requireOperatorRoomAccess(async (req) => {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      select: { roomId: true },
    });
    return order?.roomId;
  }),
  updateAiReadyFlag,
);

router.get('/menu', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), listMenuItems);
router.post('/menu', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), createMenuItem);
router.patch('/menu/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), updateMenuItem);
router.post('/menu/:id/image', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), uploadMenuItemImage);
router.delete('/menu/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), deleteMenuItem);

router.get('/rooms', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), asyncHandler(listRooms));
router.get('/rooms/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']), asyncHandler(getRoomById));
router.post('/rooms', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(createRoom));
router.patch('/rooms/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(updateRoom));
router.delete('/rooms/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), asyncHandler(deleteRoom));
router.use('/', roomSessionsRouter);

router.get('/service-counters', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), listServiceCounters);
router.post('/service-counters', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), createServiceCounter);
router.patch('/service-counters/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), updateServiceCounter);
router.delete('/service-counters/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), deleteServiceCounter);

const categoriesCompatDisabled = respondCompatDisabled(
  'categories',
  'E2-TODO: rebuild category APIs against menu_categories and categoryId foreign keys',
);

router.get('/categories', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), categoriesCompatDisabled);
router.post('/categories', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), categoriesCompatDisabled);
router.patch('/categories/:id', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), categoriesCompatDisabled);
router.post('/categories/:id/image', requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']), categoriesCompatDisabled);

router.use((err, req, res, _next) => {
  if (err.code === 'NOT_FOUND_OR_FORBIDDEN') {
    return res.status(404).json({ error: 'Resource not found' });
  }
  if (err.code === 'TENANT_MISMATCH') {
    return res.status(403).json({ error: 'Cross-tenant write forbidden' });
  }
  console.error('Admin route error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
