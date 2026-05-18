const prisma = require('./src/lib/prisma');

(async () => {
  const roomToken = '1d656f35-5ceb-4bfa-bb37-edf7c6ffd857';
  const room = await prisma.room.findUnique({ where: { roomToken }, select: { id: true, tenantId: true, siteId: true } });
  if (!room) throw new Error('ROOM_NOT_FOUND');

  await prisma.roomSession.updateMany({
    where: { tenantId: room.tenantId, roomId: room.id, status: 'occupied' },
    data: { status: 'vacant', resetAt: new Date(), resetBy: 'e3-11', closedAt: new Date() },
  });

  const session = await prisma.roomSession.create({
    data: { tenantId: room.tenantId, siteId: room.siteId, roomId: room.id, headcount: 6, status: 'occupied' },
  });

  const categories = await prisma.menuCategory.findMany({
    where: { tenantId: room.tenantId, siteId: room.siteId },
    select: { id: true, orderMode: true, limitMode: true },
  });

  for (const category of categories) {
    const needsItem = category.orderMode === 'one_off' || category.limitMode === 'per_item';
    const item = needsItem
      ? await prisma.menuItem.findFirst({ where: { tenantId: room.tenantId, siteId: room.siteId, categoryId: category.id }, select: { id: true } })
      : null;

    await prisma.sessionCategoryUsage.upsert({
      where: {
        sessionId_categoryId_itemId: {
          sessionId: session.id,
          categoryId: category.id,
          itemId: needsItem ? item?.id || null : null,
        },
      },
      update: { quantityUsed: 6 },
      create: {
        sessionId: session.id,
        roomId: room.id,
        categoryId: category.id,
        itemId: needsItem ? item?.id || null : null,
        quantityUsed: 6,
      },
    });
  }

  console.log('e3-11 R setup ok', session.id, 'categories', categories.length);
  await prisma.$disconnect();
})();
