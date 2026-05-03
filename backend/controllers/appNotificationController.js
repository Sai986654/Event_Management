const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { isExpoPushToken } = require('../services/pushNotificationService');

// GET /api/app-notifications
exports.listNotifications = asyncHandler(async (req, res) => {
  const unreadOnly = String(req.query.unreadOnly || '') === 'true';
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  const where = { userId: req.user.id };
  if (unreadOnly) where.read = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.appNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.appNotification.count({ where: { userId: req.user.id, read: false } }),
  ]);

  res.json({ notifications, unreadCount });
});

// PUT /api/app-notifications/:id/read
exports.markRead = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const n = await prisma.appNotification.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!n) return res.status(404).json({ message: 'Notification not found' });

  const updated = await prisma.appNotification.update({
    where: { id },
    data: { read: true },
  });
  res.json({ notification: updated });
});

// PUT /api/app-notifications/read-all
exports.markAllRead = asyncHandler(async (req, res) => {
  await prisma.appNotification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

// DELETE /api/app-notifications/:id
exports.deleteNotification = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const n = await prisma.appNotification.findFirst({
    where: { id, userId: req.user.id },
  });
  if (!n) return res.status(404).json({ message: 'Notification not found' });
  await prisma.appNotification.delete({ where: { id } });
  res.json({ ok: true });
});

// DELETE /api/app-notifications
exports.deleteAllNotifications = asyncHandler(async (req, res) => {
  await prisma.appNotification.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
});

// POST /api/app-notifications/devices
exports.registerPushDevice = asyncHandler(async (req, res) => {
  const expoPushToken = String(req.body?.expoPushToken || '').trim();
  const platform = String(req.body?.platform || '').trim().toLowerCase();
  const deviceName = req.body?.deviceName ? String(req.body.deviceName).trim().slice(0, 120) : null;
  const appVersion = req.body?.appVersion ? String(req.body.appVersion).trim().slice(0, 40) : null;

  if (!isExpoPushToken(expoPushToken)) {
    return res.status(400).json({ message: 'Invalid Expo push token' });
  }

  if (!['android', 'ios'].includes(platform)) {
    return res.status(400).json({ message: 'Invalid platform' });
  }

  const token = await prisma.pushToken.upsert({
    where: { expoPushToken },
    update: {
      userId: req.user.id,
      platform,
      deviceName,
      appVersion,
      isActive: true,
      lastSeenAt: new Date(),
    },
    create: {
      userId: req.user.id,
      expoPushToken,
      platform,
      deviceName,
      appVersion,
      isActive: true,
      lastSeenAt: new Date(),
    },
  });

  res.json({ ok: true, token });
});

// DELETE /api/app-notifications/devices
exports.unregisterPushDevice = asyncHandler(async (req, res) => {
  const expoPushToken = String(req.body?.expoPushToken || '').trim();
  if (!expoPushToken) {
    return res.status(400).json({ message: 'Expo push token is required' });
  }

  await prisma.pushToken.updateMany({
    where: { userId: req.user.id, expoPushToken },
    data: { isActive: false, lastSeenAt: new Date() },
  });

  res.json({ ok: true });
});
