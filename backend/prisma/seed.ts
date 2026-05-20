require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../src/lib/prisma');

const API_KEY_CONFIG_KEY = 'api_key';
const DEMO_PASSWORD = 'demo123';
const DEMO_LICENSE_EXPIRY = new Date('2028-01-01T00:00:00.000Z');

function generateApiKey() {
  return crypto.randomBytes(24).toString('base64url');
}

function encryptWifiPassword(plaintext: string, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) {
    throw new Error('WIFI_ENCRYPTION_KEY must be 32 bytes (base64-encoded)');
  }

  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([nonce, ciphertext, authTag]);
}

async function ensureSystemApiKey() {
  const existing = await prisma.systemConfig.findUnique({ where: { key: API_KEY_CONFIG_KEY } });
  if (existing && existing.value) return existing.value;

  const fromEnv = String(process.env.API_KEY || '').trim();
  const apiKey = fromEnv || generateApiKey();

  await prisma.systemConfig.upsert({
    where: { key: API_KEY_CONFIG_KEY },
    update: { value: apiKey },
    create: { key: API_KEY_CONFIG_KEY, value: apiKey },
  });

  return apiKey;
}

async function findOrCreateTenantByName(name, licenseExpiry) {
  const existing = await prisma.tenant.findFirst({ where: { name } });
  if (existing) {
    return prisma.tenant.update({
      where: { id: existing.id },
      data: { status: 'active', licenseExpiry },
    });
  }

  return prisma.tenant.create({
    data: { name, status: 'active', licenseExpiry },
  });
}

async function findOrCreateSiteByName(tenantId, name) {
  const existing = await prisma.site.findFirst({ where: { tenantId, name } });
  if (existing) return existing;
  return prisma.site.create({ data: { tenantId, name } });
}

async function upsertTenantConfig(tenantId, key, value) {
  await prisma.tenantConfig.upsert({
    where: { tenantId_key: { tenantId, key } },
    update: { value },
    create: { tenantId, key, value },
  });
}

async function ensureDemoSessionFixtures() {
  const wifiKey = String(process.env.WIFI_ENCRYPTION_KEY || '').trim();
  if (!wifiKey) {
    throw new Error('WIFI_ENCRYPTION_KEY env var required for seed');
  }

  const tenant = await findOrCreateTenantByName('Demo Bank', DEMO_LICENSE_EXPIRY);
  const site = await findOrCreateSiteByName(tenant.id, 'Demo Flagship');

  await prisma.license.upsert({
    where: { siteId: site.id },
    update: {
      tenantId: tenant.id,
      plan: 'standard',
      roomLimit: 10,
      expiryDate: DEMO_LICENSE_EXPIRY,
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      plan: 'standard',
      roomLimit: 10,
      expiryDate: DEMO_LICENSE_EXPIRY,
    },
  });

  const room = await prisma.room.upsert({
    where: { siteId_code: { siteId: site.id, code: 'room-demo' } },
    update: {
      tenantId: tenant.id,
      name: 'Room Demo',
      nameEn: 'Room Demo',
      nameTc: '示範房',
      nameSc: '示范房',
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      code: 'room-demo',
      name: 'Room Demo',
      nameEn: 'Room Demo',
      nameTc: '示範房',
      nameSc: '示范房',
    },
  });

  const roomLibrary = await prisma.room.upsert({
    where: { siteId_code: { siteId: site.id, code: 'room-library' } },
    update: {
      tenantId: tenant.id,
      name: 'Library',
      nameEn: 'Library',
      nameTc: '圖書館',
      nameSc: '图书馆',
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      code: 'room-library',
      name: 'Library',
      nameEn: 'Library',
      nameTc: '圖書館',
      nameSc: '图书馆',
    },
  });

  const roomTasting = await prisma.room.upsert({
    where: { siteId_code: { siteId: site.id, code: 'room-tasting' } },
    update: {
      tenantId: tenant.id,
      name: 'Tasting Room',
      nameEn: 'Tasting Room',
      nameTc: '品鑒室',
      nameSc: '品鉴室',
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      code: 'room-tasting',
      name: 'Tasting Room',
      nameEn: 'Tasting Room',
      nameTc: '品鑒室',
      nameSc: '品鉴室',
    },
  });

  const drinks = await prisma.menuCategory.upsert({
    where: { siteId_key: { siteId: site.id, key: 'drinks' } },
    update: {
      tenantId: tenant.id,
      nameEn: 'Drinks',
      nameTc: '飲品',
      nameSc: '饮品',
      orderMode: 'quantity',
      limitMode: 'total_per_category',
      sortOrder: 1,
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      key: 'drinks',
      nameEn: 'Drinks',
      nameTc: '飲品',
      nameSc: '饮品',
      orderMode: 'quantity',
      limitMode: 'total_per_category',
      sortOrder: 1,
    },
  });

  const tidyUp = await prisma.menuCategory.upsert({
    where: { siteId_key: { siteId: site.id, key: 'tidy-up' } },
    update: {
      tenantId: tenant.id,
      nameEn: 'Tidy Up',
      nameTc: '整理服務',
      nameSc: '整理服务',
      orderMode: 'one_off',
      limitMode: 'total_per_category',
      sortOrder: 2,
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      key: 'tidy-up',
      nameEn: 'Tidy Up',
      nameTc: '整理服務',
      nameSc: '整理服务',
      orderMode: 'one_off',
      limitMode: 'total_per_category',
      sortOrder: 2,
    },
  });

  const snacks = await prisma.menuCategory.upsert({
    where: { siteId_key: { siteId: site.id, key: 'snacks' } },
    update: {
      tenantId: tenant.id,
      nameEn: 'Snacks',
      nameTc: '小食',
      nameSc: '小食',
      orderMode: 'quantity',
      limitMode: 'per_item',
      sortOrder: 3,
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      key: 'snacks',
      nameEn: 'Snacks',
      nameTc: '小食',
      nameSc: '小食',
      orderMode: 'quantity',
      limitMode: 'per_item',
      sortOrder: 3,
    },
  });

  const menuItems = [
    { key: 'drink-coffee', categoryId: drinks.id, nameEn: 'Coffee', nameTc: '咖啡', nameSc: '咖啡' },
    { key: 'drink-tea', categoryId: drinks.id, nameEn: 'Tea', nameTc: '茶', nameSc: '茶' },
    { key: 'tidy-basic', categoryId: tidyUp.id, nameEn: 'Basic Tidy', nameTc: '基本整理', nameSc: '基本整理' },
    { key: 'tidy-deep', categoryId: tidyUp.id, nameEn: 'Deep Tidy', nameTc: '深度整理', nameSc: '深度整理' },
    { key: 'snack-chips', categoryId: snacks.id, nameEn: 'Chips', nameTc: '薯片', nameSc: '薯片' },
    { key: 'snack-nuts', categoryId: snacks.id, nameEn: 'Mixed Nuts', nameTc: '果仁', nameSc: '果仁' },
  ];

  for (const item of menuItems) {
    await prisma.menuItem.upsert({
      where: { siteId_key: { siteId: site.id, key: item.key } },
      update: {
        tenantId: tenant.id,
        categoryId: item.categoryId,
        nameEn: item.nameEn,
        nameTc: item.nameTc,
        nameSc: item.nameSc,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        siteId: site.id,
        categoryId: item.categoryId,
        key: item.key,
        nameEn: item.nameEn,
        nameTc: item.nameTc,
        nameSc: item.nameSc,
        isActive: true,
      },
    });
  }

  await upsertTenantConfig(tenant.id, 'default_alert_timeout_sec', '60');
  await upsertTenantConfig(tenant.id, 'sla_ack_sec', '60');
  await upsertTenantConfig(tenant.id, 'sla_complete_sec', '600');

  await prisma.siteBranding.upsert({
    where: { siteId: site.id },
    update: {
      tenantId: tenant.id,
      primaryColour: '#00845C',
      welcomeEn: 'Welcome to our lounge',
      welcomeTc: '歡迎光臨',
      welcomeSc: '欢迎光临',
      wifiSsid: 'Demo-Guest',
      wifiPasswordEncrypted: encryptWifiPassword('Welcome2026', wifiKey),
    },
    create: {
      tenantId: tenant.id,
      siteId: site.id,
      primaryColour: '#00845C',
      welcomeEn: 'Welcome to our lounge',
      welcomeTc: '歡迎光臨',
      welcomeSc: '欢迎光临',
      wifiSsid: 'Demo-Guest',
      wifiPasswordEncrypted: encryptWifiPassword('Welcome2026', wifiKey),
    },
  });

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const superUser = await prisma.user.upsert({
    where: { username: 'super' },
    update: {
      tenantId: null,
      email: 'super@demo.local',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'active',
      preferredLanguage: 'en',
    },
    create: {
      tenantId: null,
      username: 'super',
      email: 'super@demo.local',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'active',
      preferredLanguage: 'en',
    },
  });

  const customerAdmin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      tenantId: tenant.id,
      email: 'admin@demo.local',
      passwordHash,
      role: 'CUSTOMER_ADMIN',
      status: 'active',
      preferredLanguage: 'en',
    },
    create: {
      tenantId: tenant.id,
      username: 'admin',
      email: 'admin@demo.local',
      passwordHash,
      role: 'CUSTOMER_ADMIN',
      status: 'active',
      preferredLanguage: 'en',
    },
  });

  const operatorBev = await prisma.user.upsert({
    where: { username: 'operator-bev' },
    update: {
      tenantId: tenant.id,
      email: 'bev@demo.local',
      passwordHash,
      role: 'OPERATOR',
      status: 'active',
      preferredLanguage: 'en',
    },
    create: {
      tenantId: tenant.id,
      username: 'operator-bev',
      email: 'bev@demo.local',
      passwordHash,
      role: 'OPERATOR',
      status: 'active',
      preferredLanguage: 'en',
    },
  });

  const operatorTidy = await prisma.user.upsert({
    where: { username: 'operator-tidy' },
    update: {
      tenantId: tenant.id,
      email: 'tidy@demo.local',
      passwordHash,
      role: 'OPERATOR',
      status: 'active',
      preferredLanguage: 'en',
    },
    create: {
      tenantId: tenant.id,
      username: 'operator-tidy',
      email: 'tidy@demo.local',
      passwordHash,
      role: 'OPERATOR',
      status: 'active',
      preferredLanguage: 'en',
    },
  });

  for (const user of [customerAdmin, operatorBev, operatorTidy]) {
    await prisma.userSiteAssignment.upsert({
      where: { userId_siteId: { userId: user.id, siteId: site.id } },
      update: {},
      create: { userId: user.id, siteId: site.id },
    });
  }

  for (const assignedRoom of [room, roomLibrary, roomTasting]) {
    await prisma.roomOperatorAssignment.upsert({
      where: {
        roomId_operatorUserId: {
          roomId: assignedRoom.id,
          operatorUserId: operatorBev.id,
        },
      },
      update: {
        tenantId: tenant.id,
        siteId: site.id,
      },
      create: {
        tenantId: tenant.id,
        siteId: site.id,
        roomId: assignedRoom.id,
        operatorUserId: operatorBev.id,
      },
    });

    await prisma.roomOperatorAssignment.upsert({
      where: {
        roomId_operatorUserId: {
          roomId: assignedRoom.id,
          operatorUserId: operatorTidy.id,
        },
      },
      update: {
        tenantId: tenant.id,
        siteId: site.id,
      },
      create: {
        tenantId: tenant.id,
        siteId: site.id,
        roomId: assignedRoom.id,
        operatorUserId: operatorTidy.id,
      },
    });
  }

  await prisma.menuCategory.update({
    where: { id: drinks.id },
    data: { defaultOperatorId: operatorBev.id },
  });
  await prisma.menuCategory.update({
    where: { id: snacks.id },
    data: { defaultOperatorId: operatorBev.id },
  });
  await prisma.menuCategory.update({
    where: { id: tidyUp.id },
    data: { defaultOperatorId: operatorTidy.id },
  });

  // ── E4-05/E4-06: deterministic demo orders for the counter portal ────────
  // Recreated every seed run so RBAC / KPI / card screenshots are stable.
  // Clears prior throwaway test orders for this demo tenant.
  //
  // E4-06: each demo order is bound to an OCCUPIED RoomSession so the order
  // card's headcount stepper has a real sessionId + headcount to act on.
  // Order.items is a JSON blob shaped exactly like the guest submit path
  // {itemId,qty,name}. Status mix covers pending / overdue(aged) /
  // acknowledged / done so all four card visuals are exercisable.
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } });

  // One occupied session per demo room. Free the partial-unique
  // `one_active_per_room` index first by vacating any current occupied
  // session, then create a fresh occupied one with a known headcount.
  const demoRoomHeadcount: Array<[{ id: string }, number]> = [
    [room, 4],
    [roomLibrary, 2],
    [roomTasting, 6],
  ];
  const sessionByRoom = new Map<string, string>();
  for (const [r, headcount] of demoRoomHeadcount) {
    await prisma.roomSession.updateMany({
      where: { roomId: r.id, status: 'occupied' },
      data: { status: 'vacant', closedAt: new Date() },
    });
    const s = await prisma.roomSession.create({
      data: {
        tenantId: tenant.id,
        siteId: site.id,
        roomId: r.id,
        headcount,
        status: 'occupied',
      },
      select: { id: true },
    });
    sessionByRoom.set(r.id, s.id);
  }

  const itemRows = await prisma.menuItem.findMany({
    where: { siteId: site.id },
    select: { id: true, key: true },
  });
  const itemByKey = new Map(itemRows.map((i) => [i.key, i.id]));
  const li = (key, qty) => ({ itemId: itemByKey.get(key), qty, name: key });
  const minsAgo = (m) => new Date(Date.now() - m * 60_000);

  const demoOrders = [
    // overdue (pending & >60s) — bev (Drinks)
    { roomId: room.id, items: [li('drink-coffee', 2)], status: 'pending', createdAt: minsAgo(6) },
    // acknowledged — bev (Snacks)
    { roomId: room.id, items: [li('snack-chips', 1)], status: 'acknowledged', createdAt: minsAgo(4) },
    // FRESH pending (cross-category): bev sees (tea=Drinks), tidy sees (tidy-basic)
    { roomId: room.id, items: [li('drink-tea', 1), li('tidy-basic', 1)], status: 'pending', createdAt: minsAgo(0.05) },
    // done — bev (Drinks)
    { roomId: roomLibrary.id, items: [li('drink-coffee', 1)], status: 'done', createdAt: minsAgo(20) },
    // FRESH pending — bev (Snacks)
    { roomId: roomTasting.id, items: [li('snack-nuts', 2)], status: 'pending', createdAt: minsAgo(0.03) },
    // pure Tidy, overdue — bev NOT visible, operator-tidy visible (reverse RBAC)
    { roomId: room.id, items: [li('tidy-deep', 1)], status: 'pending', createdAt: minsAgo(3) },
  ];

  for (const o of demoOrders) {
    const acknowledged = o.status === 'acknowledged' || o.status === 'done';
    await prisma.order.create({
      data: {
        tenantId: tenant.id,
        siteId: site.id,
        roomId: o.roomId,
        sessionId: sessionByRoom.get(o.roomId),
        items: o.items,
        status: o.status,
        createdAt: o.createdAt,
        acknowledgedAt: acknowledged ? o.createdAt : null,
        acknowledgedBy: acknowledged ? operatorBev.id : null,
        completedAt: o.status === 'done' ? o.createdAt : null,
        completedBy: o.status === 'done' ? operatorBev.id : null,
      },
    });
  }

  console.log('Demo seed complete:');
  console.log(`  Orders: ${demoOrders.length} demo orders (prior tenant orders cleared)`);
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);
  console.log(`  Site:   ${site.name} (${site.id})`);
  console.log('  Rooms:  3');
  console.log(`  Users:  ${[superUser.username, customerAdmin.username, operatorBev.username, operatorTidy.username].join(' / ')} (password: ${DEMO_PASSWORD})`);

  return {
    tenant,
    site,
    rooms: [room, roomLibrary, roomTasting],
    users: [superUser, customerAdmin, operatorBev, operatorTidy],
  };
}

/**
 * E4-07: second tenant for the cross-tenant Socket.IO isolation proof.
 * Intentionally minimal — just a tenant + an OPERATOR user with no rooms
 * or categories. The user logs in, the socket joins tenant:<other>, and
 * #32 verifies that nothing on tenant 1's wire reaches this socket.
 */
async function ensureSecondTenantFixture() {
  const tenant2 = await findOrCreateTenantByName('Demo Bank Two', DEMO_LICENSE_EXPIRY);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const operator = await prisma.user.upsert({
    where: { username: 'operator-bank2' },
    update: {
      passwordHash,
      role: 'OPERATOR',
      status: 'active',
      tenantId: tenant2.id,
    },
    create: {
      username: 'operator-bank2',
      passwordHash,
      role: 'OPERATOR',
      status: 'active',
      tenantId: tenant2.id,
    },
  });
  console.log(
    `  Cross-tenant fixture: tenant=${tenant2.name} (${tenant2.id}), user=${operator.username}`,
  );
  return { tenant2, operator };
}

async function main() {
  await ensureSystemApiKey();
  await ensureDemoSessionFixtures();
  await ensureSecondTenantFixture();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    // 显式声明Node.js process类型，绕过TypeScript类型检查报错
    (globalThis as unknown as { process: { exit: (code: number) => never } }).process.exit(1);
  });
