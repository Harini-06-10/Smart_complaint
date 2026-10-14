/**
 * Smart Complaint Registration System – API server (v3)
 * Node.js + Express + MongoDB (Mongoose) + JWT + Socket.IO
 */
require('dotenv').config();
require('express-async-errors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const { setIO } = require('./services/notify');
const { startSlaEngine } = require('./services/slaEngine');
const { seedDatabase } = require('./seed');
const User = require('./models/User');

const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const statsRoutes = require('./routes/stats');
const { ai, meta, users, notifications, reports } = require('./routes/misc');
const assistantRoutes = require('./routes/assistant');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev_only_secret_change_me';
  console.warn('⚠️  JWT_SECRET not set – using a development secret. Create backend/.env from .env.example');
}

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// ---------------- Middleware ----------------
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ---------------- API routes ----------------
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/ai', ai);
app.use('/api/meta', meta);
app.use('/api/users', users);
app.use('/api/notifications', notifications);
app.use('/api/reports', reports);
app.use('/api/assistant', assistantRoutes); // v3 chatbot

// Serve the built React app (after `npm run build` in /frontend) from the same port
const clientDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads|socket\.io).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('❌', err.message);
  if (err.name === 'ValidationError') return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(', ') });
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid ID' });
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'File too large (max 15 MB)' });
  res.status(err.status || 500).json({ message: err.message || 'Something went wrong' });
});

// ---------------- Socket.IO (real-time notifications) ----------------
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', async (socket) => {
  try {
    const { token } = socket.handshake.auth || {};
    if (!token) return;
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(id).select('role');
    if (!user) return;
    socket.join(`user:${id}`);
    socket.join(`role:${user.role}`);
  } catch {
    /* anonymous / public viewer – only receives broadcasts */
  }
});
setIO(io);

// ---------------- Start ----------------
const PORT = process.env.PORT || 5000;
(async () => {
  await connectDB();
  if ((await User.countDocuments()) === 0) {
    console.log('📦 Empty database detected – loading demo data…');
    await seedDatabase();
  }
  startSlaEngine();
  server.listen(PORT, () => {
    console.log(`🚀 API running on http://localhost:${PORT}`);
    console.log(`🌐 Frontend expected at ${CLIENT_URL}`);
  });
})().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
