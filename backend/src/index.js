require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const prisma = require('./lib/prisma');
const ordersRouter = require('./routes/orders');
const menuRouter = require('./routes/menu');
const roomsRouter = require('./routes/rooms');
const serviceCountersRouter = require('./routes/serviceCounters');
const categoriesRouter = require('./routes/categories');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const guestRouter = require('./routes/guest');
const operatorRouter = require('./routes/operator');
const devRouter = process.env.NODE_ENV !== 'production' ? require('./routes/dev') : null;
const { isValidApiKey, verifyJwtToken } = require('./middleware/auth');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

io.use(async (socket, next) => {
  try {
    const authHeader = socket.handshake.headers && socket.handshake.headers.authorization;
    const bearer = typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : '';

    const tokenFromAuth = socket.handshake.auth && (socket.handshake.auth.token || socket.handshake.auth.jwt);
    const token = (typeof tokenFromAuth === 'string' ? tokenFromAuth.trim() : '') || bearer;

    if (token) {
      const payload = verifyJwtToken(token);
      if (payload && payload.uid && payload.role) {
        socket.data.admin = { id: payload.uid, role: payload.role };
        return next();
      }
    }

    const apiKeyFromHeader = socket.handshake.headers && socket.handshake.headers['x-api-key'];
    const apiKeyFromAuth = socket.handshake.auth && socket.handshake.auth.apiKey;
    const apiKeyFromQuery = socket.handshake.query && socket.handshake.query.apiKey;
    const apiKey = apiKeyFromHeader || apiKeyFromAuth || apiKeyFromQuery;

    if (await isValidApiKey(apiKey)) {
      return next();
    }

    return next(new Error('Unauthorized'));
  } catch (e) {
    return next(new Error('Unauthorized'));
  }
});

app.set('socketio', io);

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '15mb' }));

const uploadsDir = path.join(__dirname, '..', 'uploads');
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch (_) {}
app.use('/uploads', express.static(uploadsDir));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/guest', guestRouter);
app.use('/api/operator', operatorRouter);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/dev', devRouter);
  console.log('[dev] /api/dev/* endpoints enabled (NODE_ENV !== production)');
}
app.use('/api/orders', ordersRouter);
app.use('/api/menu', menuRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/service-counters', serviceCountersRouter);
app.use('/api/categories', categoriesRouter);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('Database connected');

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
