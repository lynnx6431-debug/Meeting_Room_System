const https = require('https');
const prisma = require('../src/lib/prisma');

const agent = new https.Agent({ rejectUnauthorized: false });
const BASE_URL = process.env.BASE_URL || 'https://localhost';
const HEADCOUNT = 2;
const CONCURRENT_REQUESTS = 5;

function requestJson(method, path, token, body) {
  const payload = body ? JSON.stringify(body) : '';
  const url = new URL(path, BASE_URL);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method,
        agent,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });
        res.on('end', () => resolve({ status: res.statusCode, body: responseBody }));
      },
    );

    req.on('error', (error) => resolve({ status: 0, body: error.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

async function loginAdmin() {
  const response = await requestJson('POST', '/api/admin/login', null, {
    username: 'super',
    password: 'demo123',
  });
  const parsed = JSON.parse(response.body || '{}');
  if (!parsed.token) {
    throw new Error(`Login failed: ${response.body}`);
  }
  return parsed.token;
}

async function prepareFixture(token) {
  const room = await prisma.room.findFirst({ where: { code: 'room-demo' } });
  const item = await prisma.menuItem.findFirst({ where: { key: 'snack-chips' } });
  if (!room || !item) {
    throw new Error('Missing room-demo or snack-chips seed data');
  }

  await prisma.order.deleteMany({ where: { roomId: room.id } });
  await prisma.sessionCategoryUsage.deleteMany({ where: { roomId: room.id } });
  await prisma.roomSession.deleteMany({ where: { roomId: room.id } });

  const sessionResponse = await requestJson('POST', `/api/admin/rooms/${room.id}/sessions`, token, {
    headcount: HEADCOUNT,
  });
  if (sessionResponse.status !== 201) {
    throw new Error(`Failed to create session: ${sessionResponse.body}`);
  }

  return { roomId: room.id, itemId: item.id, categoryId: item.categoryId };
}

async function postOrder(token, roomId, itemId) {
  return requestJson('POST', '/api/orders', token, {
    roomId,
    items: [{ itemId, qty: 1 }],
  });
}

(async () => {
  try {
    const token = await loginAdmin();
    const { roomId, itemId, categoryId } = await prepareFixture(token);

    const results = await Promise.all(
      Array.from({ length: CONCURRENT_REQUESTS }, () => postOrder(token, roomId, itemId)),
    );
    const succeeded = results.filter((result) => result.status === 201).length;
    const blocked = results.filter((result) => result.status === 400).length;

    console.log(`Total: ${CONCURRENT_REQUESTS}, Succeeded: ${succeeded}, Blocked: ${blocked}`);
    console.log(`Expected: Succeeded = headcount (${HEADCOUNT}), Blocked = rest (${CONCURRENT_REQUESTS - HEADCOUNT})`);
    results.forEach((result, index) => {
      console.log(`  [${index}] status=${result.status} body=${result.body.slice(0, 160)}`);
    });

    const usage = await prisma.sessionCategoryUsage.aggregate({
      where: { roomId, categoryId, itemId },
      _sum: { quantityUsed: true },
    });
    console.log(`Usage sum for item ${itemId}: ${usage._sum.quantityUsed || 0}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
