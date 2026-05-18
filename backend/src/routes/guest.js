const crypto = require('crypto');
const express = require('express');
const QRCode = require('qrcode');
const prisma = require('../lib/prisma');
const { guestAuthMiddleware, guestStateGuard } = require('../middleware/guestAuth');
const { getActiveSession, createSession } = require('../services/roomSession');
const { checkAndRecord } = require('../services/sessionLimit');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function decryptWifiPassword(encryptedBuffer) {
  if (!encryptedBuffer || encryptedBuffer.length === 0) return null;

  const keyBase64 = process.env.WIFI_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error('WIFI_ENCRYPTION_KEY env var not set');
  }

  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('WIFI_ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }

  if (encryptedBuffer.length < 28) {
    return null;
  }

  const nonce = encryptedBuffer.subarray(0, 12);
  const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
  const ciphertext = encryptedBuffer.subarray(12, encryptedBuffer.length - 16);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

function escapeWifiValue(value) {
  return String(value || '').replace(/([\\;,:"])/g, '\\$1');
}

router.use(guestAuthMiddleware);
router.use(guestStateGuard);

router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const ctx = req.guestCtx;
    const branding = await prisma.siteBranding.findUnique({
      where: { siteId: ctx.siteId },
      select: {
        primaryColour: true,
        welcomeEn: true,
        welcomeTc: true,
        welcomeSc: true,
        wifiSsid: true,
      },
    });

    return res.json({
      room: {
        id: ctx.room.id,
        name: ctx.room.name,
        nameEn: ctx.room.nameEn,
        nameTc: ctx.room.nameTc,
        nameSc: ctx.room.nameSc,
      },
      site: {
        id: ctx.siteId,
        name: ctx.room.site.name,
      },
      branding,
    });
  }),
);

router.get(
  '/menu',
  asyncHandler(async (req, res) => {
    const ctx = req.guestCtx;

    const categories = await prisma.menuCategory.findMany({
      where: {
        tenantId: ctx.tenantId,
        siteId: ctx.siteId,
      },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
      include: {
        items: {
          where: {
            tenantId: ctx.tenantId,
            siteId: ctx.siteId,
            isActive: true,
            OR: [{ roomId: null }, { roomId: ctx.roomId }],
          },
          orderBy: [{ createdAt: 'asc' }, { key: 'asc' }],
          select: {
            id: true,
            key: true,
            nameEn: true,
            nameTc: true,
            nameSc: true,
            descEn: true,
            descTc: true,
            descSc: true,
            imageUrl: true,
          },
        },
      },
    });

    return res.json({ categories });
  }),
);

router.get(
  '/session',
  asyncHandler(async (req, res) => {
    const session = await getActiveSession({
      tenantId: req.guestCtx.tenantId,
      roomId: req.guestCtx.roomId,
    });
    if (!session) {
      return res.json({ session: null, usage: [] });
    }

    const usage = await prisma.sessionCategoryUsage.findMany({
      where: { sessionId: session.id },
      select: {
        categoryId: true,
        itemId: true,
        quantityUsed: true,
      },
    });

    return res.json({ session, usage });
  }),
);

router.get(
  '/wifi-qr',
  asyncHandler(async (req, res) => {
    const ctx = req.guestCtx;
    const branding = await prisma.siteBranding.findUnique({
      where: { siteId: ctx.siteId },
      select: {
        wifiSsid: true,
        wifiPasswordEncrypted: true,
      },
    });

    if (!branding || !branding.wifiSsid) {
      return res.status(404).json({ error: 'NO_WIFI_CONFIGURED' });
    }

    let password = '';
    try {
      password = decryptWifiPassword(branding.wifiPasswordEncrypted) || '';
    } catch (error) {
      console.error('Failed to decrypt WiFi password:', error);
    }

    const type = password ? 'WPA' : 'nopass';
    const wifiString = `WIFI:T:${type};S:${escapeWifiValue(branding.wifiSsid)};P:${escapeWifiValue(password)};;`;
    const dataUrl = await QRCode.toDataURL(wifiString, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 600,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return res.json({
      ssid: branding.wifiSsid,
      dataUrl,
    });
  }),
);

router.post(
  '/session',
  asyncHandler(async (req, res) => {
    try {
      const session = await createSession({
        tenantId: req.guestCtx.tenantId,
        siteId: req.guestCtx.siteId,
        roomId: req.guestCtx.roomId,
        headcount: Number(req.body?.headcount),
      });
      return res.status(201).json(session);
    } catch (error) {
      if (error.code === 'ROOM_ALREADY_OCCUPIED') {
        return res.status(409).json({ error: error.code });
      }
      if (error.code === 'INVALID_HEADCOUNT') {
        return res.status(400).json({ error: error.code });
      }
      throw error;
    }
  }),
);

router.post(
  '/orders',
  asyncHandler(async (req, res, next) => {
    try {
      const ctx = req.guestCtx;
      const items = Array.isArray(req.body?.items) ? req.body.items : null;
      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'items required' });
      }

      for (const item of items) {
        if (!item || typeof item.itemId !== 'string' || !item.itemId.trim()) {
          return res.status(400).json({ error: 'INVALID_ITEM_ID' });
        }
        if (!Number.isInteger(item.qty) || item.qty < 1) {
          return res.status(400).json({ error: 'INVALID_QTY' });
        }
      }

      const session = await getActiveSession({
        tenantId: ctx.tenantId,
        roomId: ctx.roomId,
      });
      if (!session) {
        return res.status(400).json({ error: 'NO_ACTIVE_SESSION' });
      }

      const itemIds = [...new Set(items.map((item) => item.itemId.trim()))];
      const dbItems = await prisma.menuItem.findMany({
        where: {
          id: { in: itemIds },
          tenantId: ctx.tenantId,
          siteId: ctx.siteId,
          OR: [{ roomId: null }, { roomId: ctx.roomId }],
        },
        include: {
          category: true,
        },
      });

      if (dbItems.length !== itemIds.length) {
        return res.status(404).json({ error: 'Some items not found or not in this room\'s site' });
      }

      const byId = new Map(dbItems.map((item) => [item.id, item]));

      const order = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM room_sessions
          WHERE id = ${session.id} AND tenant_id = ${ctx.tenantId}
          FOR UPDATE
        `;

        for (const requested of items) {
          const dbItem = byId.get(requested.itemId.trim());
          await checkAndRecord(tx, {
            tenantId: ctx.tenantId,
            session,
            category: dbItem.category,
            itemId: dbItem.id,
            qty: requested.qty,
          });
        }

        return tx.order.create({
          data: {
            tenantId: ctx.tenantId,
            siteId: ctx.siteId,
            roomId: ctx.roomId,
            sessionId: session.id,
            items: items.map((item) => ({
              itemId: item.itemId.trim(),
              qty: item.qty,
              name: byId.get(item.itemId.trim()).key,
            })),
            status: 'pending',
          },
        });
      });

      const io = req.app.get('socketio');
      if (io) {
        io.emit('new_ticket', order);
      }

      return res.status(201).json(order);
    } catch (error) {
      if (
        [
          'ITEM_TAKEN',
          'CATEGORY_FULL',
          'ITEM_LIMIT_REACHED',
          'CONCURRENT_USAGE_CONFLICT',
          'INVALID_QTY_FOR_ONE_OFF',
          'INVALID_QTY',
          'NO_ACTIVE_SESSION',
          'ITEM_REQUIRED',
        ].includes(error.code)
      ) {
        return res.status(400).json({ error: error.code, ...(error.meta || {}) });
      }
      return next(error);
    }
  }),
);

router.use((err, req, res, _next) => {
  console.error('Guest route error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
