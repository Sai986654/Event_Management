require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { connectDB, prisma } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const initSocket = require('./socket');
const { createOriginHandler } = require('./config/corsOrigins');

// Route imports
const authRoutes = require('./routes/authRoutes');
const eventRoutes = require('./routes/eventRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const guestRoutes = require('./routes/guestRoutes');
const budgetRoutes = require('./routes/budgetRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const aiRoutes = require('./routes/aiRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const packageRoutes = require('./routes/packageRoutes');
const adminRoutes = require('./routes/adminRoutes');
const orderRoutes = require('./routes/orderRoutes');
const activityRoutes = require('./routes/activityRoutes');
const appNotificationRoutes = require('./routes/appNotificationRoutes');
const locationRoutes = require('./routes/locationRoutes');
const inviteVideoRoutes = require('./routes/inviteVideoRoutes');
const instantPhotoRoutes = require('./routes/instantPhotoRoutes');

const app = express();
const server = http.createServer(app);

const corsOrigin = createOriginHandler();

// Socket.io
const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
});
app.set('io', io);
initSocket(io);

// Middleware (explicit headers so preflight with Authorization succeeds reliably)
app.use(
  cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // Include Cache-Control/Pragma if any client sends them (otherwise preflight fails)
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma'],
    optionsSuccessStatus: 204,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Avoid stale JSON behind browsers/CDNs (304 + empty lists confused users)
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/app-notifications', appNotificationRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/invite-videos', inviteVideoRoutes);
app.use('/api/instant-photos', instantPhotoRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`Vedika 360 server running on port ${PORT}`);
  });

  if (String(process.env.INVITE_DRIP_ENABLED || 'true').toLowerCase() !== 'false') {
    try {
      const cron = require('node-cron');
      const { processInviteDripsTick } = require('./services/inviteDripService');
      const schedule = process.env.INVITE_DRIP_CRON || '0 9 * * *';
      cron.schedule(schedule, () => {
        processInviteDripsTick().catch((err) => console.error('[InviteDrip] cron', err?.message || err));
      });
      console.log(`[InviteDrip] cron: ${schedule} (set INVITE_DRIP_CRON / INVITE_DRIP_ENABLED)`);
    } catch (e) {
      console.warn('[InviteDrip] node-cron not installed — run: npm install node-cron');
    }
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

start();

module.exports = { app, server };
