const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { estimatePackagePrice } = require('../utils/pricing');
const { dispatchOrderQuoted } = require('../services/inAppNotificationService');

exports.createOrderQuote = asyncHandler(async (req, res) => {
  const { eventId, selections = [], notes } = req.body;
  if (!eventId || !Array.isArray(selections) || selections.length === 0) {
    return res.status(400).json({ message: 'eventId and selections are required' });
  }

  const event = await prisma.event.findUnique({ where: { id: Number(eventId) } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (req.user.role !== 'admin' && event.organizerId !== req.user.id) {
    return res.status(403).json({
      message:
        'You can only request a quote for events you organize. Sign in as the event owner or an admin.',
    });
  }

  const order = await prisma.eventOrder.create({
    data: {
      eventId: event.id,
      customerId: req.user.id,
      organizerId: event.organizerId,
      status: 'quoted',
      notes: notes || null,
    },
  });

  let total = 0;
  const itemsData = [];
  const activitiesData = [];
  const skipped = [];

  const uniquePackageIds = [
    ...new Set(
      selections
        .map((s) => Number(s.packageId))
        .filter((n) => Number.isFinite(n) && n > 0)
    ),
  ];
  const packagesLoaded = await prisma.vendorPackage.findMany({
    where: { id: { in: uniquePackageIds } },
    include: { vendor: true },
  });
  const pkgById = new Map(packagesLoaded.map((p) => [p.id, p]));

  for (const s of selections) {
    const pid = Number(s.packageId);
    if (!Number.isFinite(pid) || pid < 1) {
      skipped.push({ packageId: s.packageId, reason: 'invalid_package_id' });
      continue;
    }
    const pkg = pkgById.get(pid);
    if (!pkg) {
      skipped.push({ packageId: pid, reason: 'package_not_found' });
      continue;
    }
    if (!pkg.isActive) {
      skipped.push({ packageId: pid, reason: 'package_inactive', title: pkg.title });
      continue;
    }
    if (!pkg.vendor.isVerified) {
      skipped.push({
        packageId: pid,
        reason: 'vendor_not_verified',
        vendorId: pkg.vendorId,
        businessName: pkg.vendor.businessName,
      });
      continue;
    }

    const quotedPrice = estimatePackagePrice(pkg, s.criteria || {});
    total += quotedPrice;

    itemsData.push({
      orderId: order.id,
      vendorId: pkg.vendorId,
      packageId: pkg.id,
      category: pkg.category,
      packageTitle: pkg.title,
      criteriaSnapshot: s.criteria || {},
      quotedPrice,
    });

    activitiesData.push({
      orderId: order.id,
      eventId: event.id,
      vendorId: pkg.vendorId,
      category: pkg.category,
      title: `${pkg.category} - ${pkg.title}`,
      description: `Package tier: ${pkg.tier}`,
      status: 'not_started',
      progressPercent: 0,
      spendPlanned: quotedPrice,
      spendActual: 0,
    });
  }

  if (!itemsData.length) {
    await prisma.eventOrder.delete({ where: { id: order.id } });
    return res.status(400).json({
      message:
        'No valid package selections. Packages must exist, be active, and use verified vendors (same rules as the public package list). Refresh the planner and pick packages again.',
      skipped,
    });
  }

  await prisma.eventOrderItem.createMany({ data: itemsData });
  await prisma.eventActivity.createMany({ data: activitiesData });

  const updated = await prisma.eventOrder.update({
    where: { id: order.id },
    data: { quotedTotal: total },
    include: { items: true, activities: true },
  });

  const io = req.app.get('io');
  io.emit('order:quoted', { orderId: updated.id, eventId: updated.eventId, total: updated.quotedTotal });

  const customer = await prisma.user.findUnique({ where: { id: req.user.id } });
  // Don’t block the HTTP response on N notification rows (avoids client timeout on slow DB/network).
  dispatchOrderQuoted(io, updated, event, customer, updated.items || []).catch((err) =>
    console.error('[OrderQuote] notifications', err.message)
  );

  res.status(201).json({ order: updated });
});

exports.placeOrder = asyncHandler(async (req, res) => {
  const order = await prisma.eventOrder.findUnique({
    where: { id: Number(req.params.id) },
    include: { items: true, event: true },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (order.customerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const updated = await prisma.eventOrder.update({
    where: { id: order.id },
    data: { status: 'placed', finalTotal: order.quotedTotal },
  });

  const io = req.app.get('io');
  io.emit('order:placed', { orderId: updated.id, eventId: updated.eventId });

  res.json({ order: updated });
});

exports.getOrders = asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role === 'customer') where.customerId = req.user.id;
  if (req.user.role === 'organizer') where.organizerId = req.user.id;
  if (req.query.eventId) where.eventId = Number(req.query.eventId);

  const orders = await prisma.eventOrder.findMany({
    where,
    include: { items: true, activities: true, event: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});
