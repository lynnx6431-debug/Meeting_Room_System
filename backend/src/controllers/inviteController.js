const { createInvite, getInviteByToken, activateInvite } = require('../services/invite');

function buildInviteLink(req, rawToken) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/activate?token=${rawToken}`;
}

async function postInvite(req, res, next) {
  try {
    if (!req.ctx || !req.ctx.role || !req.ctx.userId) {
      return res.status(401).json({ error: 'UNAUTHENTICATED' });
    }

    const { email, role, tenantId, siteAssignments } = req.body || {};
    if (siteAssignments !== undefined) {
      return res.status(400).json({ error: 'SITE_ASSIGNMENTS_UNSUPPORTED_BY_SCHEMA' });
    }

    const { invite, rawToken } = await createInvite({
      caller: req.ctx,
      email,
      role,
      tenantId,
    });

    return res.status(201).json({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        tenantId: invite.tenantId,
        status: invite.status,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
      link: buildInviteLink(req, rawToken),
    });
  } catch (error) {
    if (
      [
        'FORBIDDEN_INVITE_ROLE',
        'TENANT_ID_REQUIRED',
        'TENANT_NOT_FOUND',
        'TENANT_CONTEXT_REQUIRED',
        'INVALID_EMAIL',
        'INVALID_INVITE_ROLE',
      ].includes(error.code)
    ) {
      return res.status(400).json({ error: error.code, ...(error.meta || {}) });
    }
    return next(error);
  }
}

async function getInvite(req, res, next) {
  try {
    const invite = await getInviteByToken(req.params.token);
    return res.json({
      email: invite.email,
      role: invite.role,
      tenantName: invite.tenant?.name || null,
      expiresAt: invite.expiresAt,
    });
  } catch (error) {
    if (['INVALID_INVITE', 'INVITE_EXPIRED', 'INVITE_ALREADY_USED'].includes(error.code)) {
      return res.status(400).json({ error: error.code });
    }
    return next(error);
  }
}

async function activate(req, res, next) {
  try {
    const { username, password } = req.body || {};
    const user = await activateInvite({
      rawToken: req.params.token,
      username,
      password,
    });

    return res.status(201).json({
      user,
    });
  } catch (error) {
    if (
      [
        'INVALID_INVITE',
        'INVITE_EXPIRED',
        'INVITE_ALREADY_USED',
        'INVALID_USERNAME',
        'PASSWORD_TOO_SHORT',
      ].includes(error.code)
    ) {
      return res.status(400).json({ error: error.code });
    }
    if (['USERNAME_TAKEN', 'EMAIL_TAKEN'].includes(error.code)) {
      return res.status(409).json({ error: error.code });
    }
    return next(error);
  }
}

module.exports = {
  postInvite,
  getInvite,
  activate,
};
