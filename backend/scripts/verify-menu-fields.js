const prisma = require('../src/lib/prisma');

(async () => {
  try {
    const cat = await prisma.menuCategory.findMany({
      select: {
        id: true,
        key: true,
        orderMode: true,
        limitMode: true,
        defaultOperatorId: true,
        nameEn: true,
        nameTc: true,
        nameSc: true,
        tenantId: true,
        siteId: true,
      },
      take: 1,
    });

    const item = await prisma.menuItem.findMany({
      select: {
        id: true,
        key: true,
        categoryId: true,
        nameEn: true,
        nameTc: true,
        nameSc: true,
        tenantId: true,
        siteId: true,
      },
      take: 1,
    });

    console.log('MenuCategory fields OK:', JSON.stringify(cat));
    console.log('MenuItem fields OK:', JSON.stringify(item));
  } catch (e) {
    console.error('Verify failed:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
