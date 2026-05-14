const express = require('express');
const prisma = require('../lib/prisma');
const { validateApiKey } = require('../middleware/auth');

const router = express.Router();

router.use(validateApiKey);

router.get('/', async (req, res) => {
  try {
    const list = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        nameZh: true,
        nameEn: true,
        nameHant: true,
        imageUrl: true,
        serviceCounterId: true,
      },
    });
    return res.json(list);
  } catch (_) {
    return res.status(500).json({ error: 'Failed to list categories' });
  }
});

module.exports = router;
