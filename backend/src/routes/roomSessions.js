const express = require('express');
const {
  getRoomSession,
  createRoomSession,
  resetRoomSession,
  overrideRoomHeadcount,
} = require('../controllers/roomSessionController');
const { requireRole, requireOperatorRoomAccess } = require('../middleware/rbac');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get(
  '/rooms/:id/session',
  requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']),
  asyncHandler(getRoomSession),
);
router.post(
  '/rooms/:id/sessions',
  requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']),
  asyncHandler(createRoomSession),
);
router.post(
  '/rooms/:id/reset',
  requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN']),
  asyncHandler(resetRoomSession),
);
router.patch(
  '/rooms/:id/headcount',
  requireRole(['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR']),
  requireOperatorRoomAccess(async (req) => req.params.id),
  asyncHandler(overrideRoomHeadcount),
);

module.exports = router;
