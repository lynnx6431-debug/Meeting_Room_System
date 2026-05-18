const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const API_KEY_CONFIG_KEY = 'api_key';
const API_KEY_CACHE_TTL_MS = 5000;

let apiKeyCache = { value: null, fetchedAt: 0 };

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) {
    throw new Error('Missing JWT_SECRET');
  }
  return secret;
};

const generateApiKey = () => crypto.randomBytes(24).toString('base64url');

const getExpectedApiKey = async () => {
  const now = Date.now();
  if (apiKeyCache.value && now - apiKeyCache.fetchedAt < API_KEY_CACHE_TTL_MS) {
    return apiKeyCache.value;
  }

  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: API_KEY_CONFIG_KEY } });
    const fromDb = row && typeof row.value === 'string' ? row.value.trim() : '';
    const fromEnv = String(process.env.API_KEY || '').trim();
    const expected = fromDb || fromEnv || '';

    apiKeyCache = { value: expected || null, fetchedAt: now };
    return expected;
  } catch (_) {
    const fromEnv = String(process.env.API_KEY || '').trim();
    apiKeyCache = { value: fromEnv || null, fetchedAt: now };
    return fromEnv;
  }
};

const isValidApiKey = async (apiKey) => {
  const expected = await getExpectedApiKey();
  return Boolean(apiKey) && Boolean(expected) && apiKey === expected;
};

const validateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!(await isValidApiKey(apiKey))) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or missing API key' });
    }
    return next();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to validate API key' });
  }
};

const signJwtToken = ({ userId, role }) => {
  const secret = getJwtSecret();
  return jwt.sign(
    { uid: userId, role },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: '12h',
    },
  );
};

const verifyJwtToken = (token) => {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch (_) {
    return null;
  }
};

const extractBearerToken = (authorizationValue) => {
  const raw = String(authorizationValue || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (!lower.startsWith('bearer ')) return '';
  return raw.slice(7).trim();
};

const validateJwt = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  const payload = token ? verifyJwtToken(token) : null;
  if (!payload || !payload.uid || !payload.role) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token' });
  }
  req.admin = { id: payload.uid, role: payload.role };
  return next();
};

const validateJwtOrApiKey = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);
    const payload = token ? verifyJwtToken(token) : null;
    if (payload && payload.uid && payload.role) {
      req.admin = { id: payload.uid, role: payload.role };
      req.authType = 'jwt';
      return next();
    }

    const apiKey = req.headers['x-api-key'];
    if (await isValidApiKey(apiKey)) {
      req.authType = 'api_key';
      return next();
    }

    return res.status(401).json({ error: 'Unauthorized: Invalid token or API key' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to validate request auth' });
  }
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.admin || req.admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden: SUPER_ADMIN required' });
  }
  return next();
};

const clearApiKeyCache = () => {
  apiKeyCache = { value: null, fetchedAt: 0 };
};

module.exports = {
  API_KEY_CONFIG_KEY,
  clearApiKeyCache,
  generateApiKey,
  getExpectedApiKey,
  isValidApiKey,
  requireSuperAdmin,
  signJwtToken,
  validateApiKey,
  validateJwt,
  validateJwtOrApiKey,
  verifyJwtToken,
};
