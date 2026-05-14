// 移除 crypto 的显式导入，后续通过 require('crypto') 按需使用
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

const API_KEY_CONFIG_KEY = 'api_key';

function generateApiKey() {
  return require('crypto').randomBytes(24).toString('base64url');
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

async function ensureDefaultSuperAdmin() {
  const username = 'admin';
  const passwordPlain = 'admin123';

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') {
      await prisma.adminUser.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN' } });
    }
    return;
  }

  const passwordHash = await bcrypt.hash(passwordPlain, 10);
  await prisma.adminUser.create({
    data: {
      username,
      passwordHash,
      role: 'SUPER_ADMIN',
    },
  });
}

async function ensureDefaultServiceCounters() {
  const existing = await prisma.serviceCounter.count();
  if (existing > 0) return;

  await prisma.serviceCounter.createMany({
    data: [{ name: '水吧', nameZh: '水吧' }, { name: '零食区', nameZh: '零食区' }],
  });
}

async function main() {
  await ensureSystemApiKey();
  await ensureDefaultSuperAdmin();
  await ensureDefaultServiceCounters();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
