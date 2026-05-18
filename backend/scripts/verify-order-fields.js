const prisma = require('../src/lib/prisma');

(async () => {
  try {
    const sample = await prisma.order.findMany({
      select: {
        id: true,
        status: true,
        acknowledgedAt: true,
        acknowledgedBy: true,
        completedAt: true,
        completedBy: true,
        sessionId: true,
        tenantId: true,
        siteId: true,
      },
      take: 1,
    });

    console.log('Order fields ok, sample:', sample);
  } catch (error) {
    console.error('Order field verification failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
