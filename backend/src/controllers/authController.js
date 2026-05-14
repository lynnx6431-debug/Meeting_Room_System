const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { signJwtToken } = require('../middleware/auth');

const login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const u = String(username || '').trim();
    const p = String(password || '');

    if (!u || !p) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await prisma.adminUser.findUnique({ where: { username: u } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(p, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signJwtToken({ userId: user.id, role: user.role });
    return res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to login' });
  }
};

module.exports = { login };

