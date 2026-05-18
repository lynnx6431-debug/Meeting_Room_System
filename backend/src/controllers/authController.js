const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const ACCESS_TOKEN_TTL = '1h';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function buildRefreshToken() {
  const raw = newRefreshToken();
  return {
    raw,
    tokenHash: sha256(raw),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  };
}

function signAccessToken(user) {
  return jwt.sign(
    { uid: user.id, role: user.role, tenantId: user.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

async function issueRefreshToken(client, userId, extra = {}) {
  const next = buildRefreshToken();
  const record = await client.refreshToken.create({
    data: {
      userId,
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
      revoked: false,
      userAgent: extra.userAgent || null,
      ip: extra.ip || null,
    },
  });
  return { raw: next.raw, expiresAt: next.expiresAt, recordId: record.id };
}

function refreshCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    expires: expiresAt,
    path: '/api/admin',
  };
}

function setRefreshCookie(res, raw, expiresAt) {
  res.cookie('refresh_token', raw, refreshCookieOptions(expiresAt));
}

function clearRefreshCookie(res) {
  res.clearCookie('refresh_token', {
    path: '/api/admin',
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
    httpOnly: true,
  });
}

async function login(req, res) {
  try {
    const { username, email, password } = req.body || {};
    const loginKey = String(username || email || '').trim();
    const passwordValue = String(password || '');

    if (!loginKey || !passwordValue) {
      return res.status(400).json({ error: 'username and password required' });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: loginKey }, { email: loginKey }],
      },
    });
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.passwordHash || !(await bcrypt.compare(passwordValue, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAccessToken(user);
    const { raw, expiresAt } = await issueRefreshToken(prisma, user.id, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setRefreshCookie(res, raw, expiresAt);

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        status: user.status,
      },
    });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Failed to login' });
  }
}

async function refresh(req, res) {
  try {
    const raw = req.cookies?.refresh_token;
    if (!raw) return res.status(401).json({ error: 'NO_REFRESH_TOKEN' });

    const tokenHash = sha256(raw);
    const result = await prisma.$transaction(async (tx) => {
      const record = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!record) {
        return { status: 'invalid' };
      }

      if (record.revoked) {
        await tx.refreshToken.updateMany({
          where: { userId: record.userId, revoked: false },
          data: { revoked: true, revokedAt: new Date() },
        });
        return { status: 'reused', userId: record.userId };
      }

      if (record.expiresAt < new Date()) {
        return { status: 'expired' };
      }

      if (!record.user || record.user.status !== 'active') {
        return { status: 'inactive' };
      }

      // Claim the current refresh token exactly once so concurrent refreshes cannot fork.
      const claimed = await tx.refreshToken.updateMany({
        where: { id: record.id, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return { status: 'invalid' };
      }

      const issued = await issueRefreshToken(tx, record.user.id, {
        userAgent: req.headers['user-agent'],
        ip: req.ip,
      });
      await tx.refreshToken.update({
        where: { id: record.id },
        data: { replacedBy: issued.recordId },
      });

      return {
        status: 'ok',
        user: record.user,
        raw: issued.raw,
        expiresAt: issued.expiresAt,
      };
    });

    if (result.status === 'invalid' || result.status === 'expired' || result.status === 'reused') {
      clearRefreshCookie(res);
      if (result.status === 'reused') {
        console.warn(`[SECURITY] Reuse of revoked refresh token by user ${result.userId}`);
      }
      return res.status(401).json({ error: 'INVALID_REFRESH_TOKEN' });
    }

    if (result.status === 'inactive') {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'USER_INACTIVE' });
    }

    const token = signAccessToken(result.user);
    setRefreshCookie(res, result.raw, result.expiresAt);
    return res.json({ token });
  } catch (e) {
    console.error('Refresh error:', e);
    clearRefreshCookie(res);
    return res.status(500).json({ error: 'Failed to refresh token' });
  }
}

async function logout(req, res) {
  try {
    const raw = req.cookies?.refresh_token;
    if (raw) {
      const tokenHash = sha256(raw);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revoked: false },
        data: { revoked: true, revokedAt: new Date() },
      });
    }
    clearRefreshCookie(res);
    return res.status(204).send();
  } catch (e) {
    console.error('Logout error:', e);
    clearRefreshCookie(res);
    return res.status(500).json({ error: 'Failed to logout' });
  }
}

module.exports = {
  login,
  refresh,
  logout,
};
