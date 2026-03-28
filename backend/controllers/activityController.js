const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

exports.getActivitiesByOrder = asyncHandler(async (req, res) => {
  const order = await prisma.eventOrder.findUnique({ where: { id: Number(req.params.orderId) } });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const allowed =
    req.user.role === 'admin' ||
    req.user.id === order.customerId ||
    req.user.id === order.organizerId;

  if (!allowed) {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    const vendorAllowed = !!vendor && activitiesBelongToVendor(vendor.id, order.id);
    if (!vendorAllowed) return res.status(403).json({ message: 'Not authorized' });
  }

  const activities = await prisma.eventActivity.findMany({
    where: { orderId: order.id },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ activities });
});

const activitiesBelongToVendor = async (vendorId, orderId) => {
  const count = await prisma.eventActivity.count({
    where: { orderId, vendorId },
  });
  return count > 0;
};

exports.updateActivityProgress = asyncHandler(async (req, res) => {
  const activity = await prisma.eventActivity.findUnique({
    where: { id: Number(req.params.id) },
    include: { order: true },
  });
  if (!activity) return res.status(404).json({ message: 'Activity not found' });

  if (req.user.role !== 'admin' && activity.order.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Only the event organizer can update activity progress' });
  }

  const progress = Math.max(0, Math.min(100, Number(req.body.progressPercent ?? activity.progressPercent)));
  const nextStatus =
    req.body.status || (progress === 100 ? 'completed' : progress > 0 ? 'in_progress' : 'not_started');

  const updated = await prisma.eventActivity.update({
    where: { id: activity.id },
    data: {
      progressPercent: progress,
      status: nextStatus,
      spendActual: req.body.spendActual ?? activity.spendActual,
      updatedById: req.user.id,
      updatedByUserAt: new Date(),
    },
  });

  const io = req.app.get('io');
  io.emit('activity:updated', {
    activityId: updated.id,
    orderId: updated.orderId,
    eventId: updated.eventId,
    progressPercent: updated.progressPercent,
    status: updated.status,
    spendActual: updated.spendActual,
  });

  res.json({ activity: updated });
});
