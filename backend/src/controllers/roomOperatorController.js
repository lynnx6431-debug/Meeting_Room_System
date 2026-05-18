const svc = require('../services/roomOperator');

async function list(req, res, next) {
  try {
    const data = await svc.listAssignments({
      tenantId: req.ctx.tenantId,
      siteId: req.query.siteId,
    });
    return res.json(data);
  } catch (error) {
    if (error.code === 'SITE_NOT_FOUND') {
      return res.status(400).json({ error: error.code });
    }
    return next(error);
  }
}

async function matrix(req, res, next) {
  try {
    const data = await svc.getMatrix({
      tenantId: req.ctx.tenantId,
      siteId: req.query.siteId,
    });
    return res.json(data);
  } catch (error) {
    if (['SITE_ID_REQUIRED', 'SITE_NOT_FOUND'].includes(error.code)) {
      return res.status(400).json({ error: error.code });
    }
    return next(error);
  }
}

async function create(req, res, next) {
  try {
    const { roomId, operatorUserId } = req.body || {};
    if (!roomId || !operatorUserId) {
      return res.status(400).json({ error: 'ROOM_ID_AND_OPERATOR_REQUIRED' });
    }

    const data = await svc.createAssignment({
      tenantId: req.ctx.tenantId,
      roomId,
      operatorUserId,
    });
    return res.status(201).json(data);
  } catch (error) {
    if (
      ['ROOM_NOT_FOUND', 'OPERATOR_NOT_FOUND', 'OPERATOR_NOT_IN_SITE', 'ASSIGNMENT_EXISTS'].includes(error.code)
    ) {
      return res.status(400).json({ error: error.code });
    }
    return next(error);
  }
}

async function remove(req, res, next) {
  try {
    const { roomId, operatorUserId } = req.params;
    await svc.deleteAssignment({
      tenantId: req.ctx.tenantId,
      roomId,
      operatorUserId,
    });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({ error: error.code });
    }
    return next(error);
  }
}

async function putMatrix(req, res, next) {
  try {
    const { siteId, desired } = req.body || {};
    const result = await svc.replaceMatrix({
      tenantId: req.ctx.tenantId,
      siteId,
      desired,
    });
    const matrix = await svc.getMatrix({
      tenantId: req.ctx.tenantId,
      siteId,
    });
    return res.json({
      ...result,
      matrix,
    });
  } catch (error) {
    if (
      [
        'SITE_ID_REQUIRED',
        'SITE_NOT_FOUND',
        'DESIRED_MUST_BE_ARRAY',
        'INVALID_ASSIGNMENT_PAIR',
        'ROOM_NOT_FOUND',
        'OPERATOR_NOT_FOUND',
        'OPERATOR_NOT_IN_SITE',
        'ROOM_SITE_MISMATCH',
      ].includes(error.code)
    ) {
      return res.status(400).json({ error: error.code });
    }
    return next(error);
  }
}

async function mySelf(req, res, next) {
  try {
    const data = await svc.listMyAssignments({
      tenantId: req.ctx.tenantId,
      userId: req.ctx.userId,
    });
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  list,
  matrix,
  create,
  remove,
  putMatrix,
  mySelf,
};
