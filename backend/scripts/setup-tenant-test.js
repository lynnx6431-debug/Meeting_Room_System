const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

(async () => {
  try {
    await prisma.user.deleteMany({ where: { username: { in: ['tenant-a-admin', 'tenant-b-admin'] } } });
    await prisma.room.deleteMany({ where: { name: { in: ['Room A', 'Room B'] } } });
    await prisma.site.deleteMany({ where: { name: { in: ['Site A', 'Site B'] } } });
    await prisma.tenant.deleteMany({ where: { name: { in: ['Tenant A', 'Tenant B'] } } });

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A', licenseExpiry: new Date('2028-01-01T00:00:00.000Z'), status: 'active' },
    });
    const siteA = await prisma.site.create({
      data: { tenantId: tenantA.id, name: 'Site A' },
    });
    const roomA = await prisma.room.create({
      data: { tenantId: tenantA.id, siteId: siteA.id, name: 'Room A', code: 'room-a' },
    });
    await prisma.user.create({
      data: {
        tenantId: tenantA.id,
        username: 'tenant-a-admin',
        email: null,
        passwordHash: await bcrypt.hash('test123', 10),
        role: 'CUSTOMER_ADMIN',
        status: 'active',
      },
    });

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B', licenseExpiry: new Date('2028-01-01T00:00:00.000Z'), status: 'active' },
    });
    const siteB = await prisma.site.create({
      data: { tenantId: tenantB.id, name: 'Site B' },
    });
    const roomB = await prisma.room.create({
      data: { tenantId: tenantB.id, siteId: siteB.id, name: 'Room B', code: 'room-b' },
    });
    await prisma.user.create({
      data: {
        tenantId: tenantB.id,
        username: 'tenant-b-admin',
        email: null,
        passwordHash: await bcrypt.hash('test123', 10),
        role: 'CUSTOMER_ADMIN',
        status: 'active',
      },
    });

    console.log(
      JSON.stringify(
        {
          tenantA: tenantA.id,
          tenantB: tenantB.id,
          roomA: roomA.id,
          roomB: roomB.id,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
