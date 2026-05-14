const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');
const { listServiceCounters } = require('../controllers/serviceCounterController');

router.use(validateApiKey);
router.get('/', listServiceCounters);

module.exports = router;

