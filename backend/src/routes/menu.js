const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');
const { listMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');

router.use(validateApiKey);

router.get('/', listMenuItems);
router.post('/', createMenuItem);
router.patch('/:id', updateMenuItem);
router.delete('/:id', deleteMenuItem);

module.exports = router;
