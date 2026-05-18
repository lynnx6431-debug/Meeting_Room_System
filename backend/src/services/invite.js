const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const INVITE_TTL_MS = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^.+@.+\..+$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function newInviteToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function canInvite({ callerRole, targetRole }) {
  if (callerRole === 'SUPER_ADMIN') {
    return targetRole === 'CUSTOMER_ADMIN' || targetRole === 'SUPER_ADMIN';
  }
  if (callerRole === 'CUSTOMER_ADMIN') {
    return targetRole === 'OPERATOR';
  }
  return false;
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

async function ensureTenantExists(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!tenant) {
    const err = new Error('TENANT_NOT_FOUND');
    err.code = 'TENANT_NOT_FOUND';
    throw err;
  }
}

function validateInvitePayload({ email, role }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    const err = new Error('INVALID_EMAIL');
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  if (!['SUPER_ADMIN', 'CUSTOMER_ADMIN', 'OPERATOR'].includes(role)) {
    const err = new Error('INVALID_INVITE_ROLE');
    err.code = 'INVALID_INVITE_ROLE';
    throw err;
  }

  return normalizedEmail;
}

async function createInvite({ caller, email, role, tenantId }) {
  const normalizedEmail = validateInvitePayload({ email, role });

  if (!caller || !caller.userId || !caller.role) {
    const err = new Error('UNAUTHENTICATED');
    err.code = 'UNAUTHENTICATED';
    throw err;
  }

  if (!canInvite({ callerRole: caller.role, targetRole: role })) {
    const err = new Error('FORBIDDEN_INVITE_ROLE');
    err.code = 'FORBIDDEN_INVITE_ROLE';
    err.meta = { callerRole: caller.role, targetRole: role };
    throw err;
  }

  let resolvedTenantId = null;
  if (role === 'SUPER_ADMIN') {
    resolvedTenantId = null;
  } else if (caller.role === 'SUPER_ADMIN') {
    const nextTenantId = typeof tenantId === 'string' ? tenantId.trim() : '';
    if (!nextTenantId) {
      const err = new Error('TENANT_ID_REQUIRED');
      err.code = 'TENANT_ID_REQUIRED';
      throw err;
    }
    await ensureTenantExists(nextTenantId);
    resolvedTenantId = nextTenantId;
  } else {
    if (!caller.tenantId) {
      const err = new Error('TENANT_CONTEXT_REQUIRED');
      err.code = 'TENANT_CONTEXT_REQUIRED';
      throw err;
    }
    resolvedTenantId = caller.tenantId;
  }

  const rawToken = newInviteToken();
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invite = await prisma.invite.create({
    data: {
      tenantId: resolvedTenantId,
      email: normalizedEmail,
      role,
      tokenHash,
      expiresAt,
      createdBy: caller.userId,
    },
  });

  return { invite, rawToken };
}

async function getInviteByToken(rawToken) {
  const tokenHash = sha256(String(rawToken || ''));
  const invite = await prisma.invite.findUnique({
    where: { tokenHash },
    include: {
      tenant: {
        select: { name: true },
      },
    },
  });

  if (!invite) {
    const err = new Error('INVALID_INVITE');
    err.code = 'INVALID_INVITE';
    throw err;
  }

  if (invite.status !== 'pending' || invite.activatedAt) {
    const err = new Error('INVITE_ALREADY_USED');
    err.code = 'INVITE_ALREADY_USED';
    throw err;
  }

  if (invite.expiresAt < new Date()) {
    const err = new Error('INVITE_EXPIRED');
    err.code = 'INVITE_EXPIRED';
    throw err;
  }

  return invite;
}

function validateActivationInput({ username, password }) {
  const normalizedUsername = typeof username === 'string' ? username.trim() : '';
  if (normalizedUsername.length < 3) {
    const err = new Error('INVALID_USERNAME');
    err.code = 'INVALID_USERNAME';
    throw err;
  }

  if (typeof password !== 'string' || password.length < 8) {
    const err = new Error('PASSWORD_TOO_SHORT');
    err.code = 'PASSWORD_TOO_SHORT';
    throw err;
  }

  return normalizedUsername;
}

function mapUserCreateError(error) {
  if (error && error.code === 'P2002') {
    const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
    if (target.includes('username')) {
      const err = new Error('USERNAME_TAKEN');
      err.code = 'USERNAME_TAKEN';
      throw err;
    }
    if (target.includes('email')) {
      const err = new Error('EMAIL_TAKEN');
      err.code = 'EMAIL_TAKEN';
      throw err;
    }
  }
  throw error;
}

async function activateInvite({ rawToken, username, password }) {
  const normalizedUsername = validateActivationInput({ username, password });
  const tokenHash = sha256(String(rawToken || ''));
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({
      where: { tokenHash },
    });

    if (!invite) {
      const err = new Error('INVALID_INVITE');
      err.code = 'INVALID_INVITE';
      throw err;
    }

    if (invite.status !== 'pending' || invite.activatedAt) {
      const err = new Error('INVITE_ALREADY_USED');
      err.code = 'INVITE_ALREADY_USED';
      throw err;
    }

    if (invite.expiresAt < new Date()) {
      const err = new Error('INVITE_EXPIRED');
      err.code = 'INVITE_EXPIRED';
      throw err;
    }

    const activatedAt = new Date();
    const claimed = await tx.invite.updateMany({
      where: {
        id: invite.id,
        status: 'pending',
        activatedAt: null,
      },
      data: {
        status: 'activated',
        activatedAt,
      },
    });

    if (claimed.count !== 1) {
      const err = new Error('INVITE_ALREADY_USED');
      err.code = 'INVITE_ALREADY_USED';
      throw err;
    }

    try {
      const user = await tx.user.create({
        data: {
          tenantId: invite.tenantId,
          username: normalizedUsername,
          email: invite.email,
          passwordHash,
          role: invite.role,
          status: 'active',
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          tenantId: true,
          status: true,
        },
      });

      return user;
    } catch (error) {
      mapUserCreateError(error);
    }
  });
}

module.exports = {
  createInvite,
  getInviteByToken,
  activateInvite,
};
