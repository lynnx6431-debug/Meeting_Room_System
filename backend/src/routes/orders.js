const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderStats, updateOrderStatus, updateAiReadyFlag } = require('../controllers/orderController');
const { validateApiKey } = require('../middleware/auth');

router.use(validateApiKey);

router.get('/stats', getOrderStats);
router.post('/', createOrder);
router.get('/', getOrders);
router.patch('/:id/status', updateOrderStatus);
router.patch('/:id/ai-ready', updateAiReadyFlag);

module.exports = router;
