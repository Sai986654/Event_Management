const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

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
