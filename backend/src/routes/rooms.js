const express = require('express');
const router = express.Router();
const { validateApiKey } = require('../middleware/auth');
const { listRooms, createRoom, updateRoom, deleteRoom } = require('../controllers/roomController');

router.use(validateApiKey);

router.get('/', listRooms);
router.post('/', createRoom);
router.patch('/:id', updateRoom);
router.delete('/:id', deleteRoom);

module.exports = router;
