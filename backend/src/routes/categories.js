const express = require('express');
const { validateApiKey } = require('../middleware/auth');

const router = express.Router();

router.use(validateApiKey);

// E2-TODO: rebuild public category endpoint against menu_categories in V4.
router.get('/', async (req, res) =>
  res.status(503).json({
    error: 'Categories API is temporarily disabled in V4 compatibility mode',
    code: 'E1_V4_COMPAT_DISABLED',
    feature: 'categories',
    todo: 'E2-TODO: rebuild public category endpoint against menu_categories',
  }));

module.exports = router;
