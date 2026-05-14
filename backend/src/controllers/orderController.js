const prisma = require('../lib/prisma');

const normalizeItems = (items) =>
  items.map((item) => ({
    name: String(item.name).trim(),
    qty: item.qty,
  }));

const createOrder = async (req, res) => {
  try {
    const { roomId, items } = req.body;

    if (!roomId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'roomId and items are required' });
    }

    for (const item of items) {
      if (!item.name || !item.qty || typeof item.qty !== 'number' || item.qty <= 0) {
        return res.status(400).json({ error: 'Each item must have name and positive qty' });
      }
    }

    const normalizedItems = normalizeItems(items);

    const order = await prisma.$transaction(async (tx) => {
      const names = [...new Set(normalizedItems.map((i) => i.name))];
      const menuItems = await tx.menuItem.findMany({
        where: { name: { in: names } },
      });

      const byName = new Map(menuItems.map((m) => [m.name, m]));

      for (const requested of normalizedItems) {
        const menu = byName.get(requested.name);
        if (!menu || !menu.isActive) {
          const err = new Error(`Item not available: ${requested.name}`);
          err.code = 'ITEM_NOT_AVAILABLE';
          throw err;
        }
        if (menu.stock < requested.qty) {
          const err = new Error(`Out of stock: ${requested.name}`);
          err.code = 'OUT_OF_STOCK';
          err.meta = { name: requested.name, stock: menu.stock, requested: requested.qty };
          throw err;
        }
      }

      for (const requested of normalizedItems) {
        await tx.menuItem.update({
          where: { name: requested.name },
          data: { stock: { decrement: requested.qty } },
        });
      }

      return tx.order.create({
        data: {
          roomId: String(roomId).trim(),
          items: normalizedItems,
          status: 'pending',
        },
      });
    });

    const io = req.app.get('socketio');
    io.emit('new_order', order);
    io.emit('newOrder', order);

    res.status(201).json(order);
  } catch (error) {
    console.error('Create order error:', error);
    if (error.code === 'ITEM_NOT_AVAILABLE') {
      return res.status(409).json({ error: error.message });
    }
    if (error.code === 'OUT_OF_STOCK') {
      return res.status(409).json({ error: error.message, meta: error.meta });
    }
    res.status(500).json({ error: 'Failed to create order' });
  }
};

const getOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status && ['pending', 'completed'].includes(status)) {
      where.status = status;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
};

const getOrderStats = async (req, res) => {
  try {
    const total = await prisma.order.count();
    const pending = await prisma.order.count({ where: { status: 'pending' } });
    const completed = await prisma.order.count({ where: { status: 'completed' } });
    const aiReadyTotal = await prisma.order.count({ where: { aiReadyFlag: true } });
    const aiReadyPending = await prisma.order.count({ where: { status: 'pending', aiReadyFlag: true } });
    const aiReadyCompleted = await prisma.order.count({
      where: { status: 'completed', aiReadyFlag: true },
    });

    res.json({
      total,
      byStatus: { pending, completed },
      aiReady: { total: aiReadyTotal, pending: aiReadyPending, completed: aiReadyCompleted },
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({ error: 'Failed to get order stats' });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    const io = req.app.get('socketio');
    io.emit('order_updated', order);
    io.emit('orderUpdated', order);

    res.json(order);
  } catch (error) {
    console.error('Update order error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: 'Failed to update order' });
  }
};

const updateAiReadyFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { aiReadyFlag } = req.body;

    if (typeof aiReadyFlag !== 'boolean') {
      return res.status(400).json({ error: 'aiReadyFlag must be boolean' });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { aiReadyFlag },
    });

    const io = req.app.get('socketio');
    io.emit('order_updated', order);
    io.emit('orderUpdated', order);

    res.json(order);
  } catch (error) {
    console.error('Update aiReadyFlag error:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.status(500).json({ error: 'Failed to update aiReadyFlag' });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderStats,
  updateOrderStatus,
  updateAiReadyFlag,
};
