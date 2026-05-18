const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderStats, updateOrderStatus, updateAiReadyFlag } = require('../controllers/orderController');
const { validateJwtOrApiKey } = require('../middleware/auth');
const { tenantContextMiddleware } = require('../middleware/tenantContext');
const { deprecationWarning } = require('../middleware/deprecationWarning');

const REMOVAL_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();

// DEPRECATED: API_KEY auth fallback retained for E2-06 30-day deprecation window.
// Will be removed after Guest /api/guest/* path (E2-07) is fully shipped.
router.use(
  deprecationWarning({
    replacement: '/api/guest/orders (for guests) or /api/admin/orders (for staff)',
    removalDate: REMOVAL_DATE,
  }),
);
router.use(validateJwtOrApiKey);
router.use(tenantContextMiddleware);

router.get('/stats', getOrderStats);
router.post('/', createOrder);
router.get('/', getOrders);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/ai-ready', updateAiReadyFlag);

router.use((err, req, res, _next) => {
  console.error('Orders route error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

module.exports = router;
