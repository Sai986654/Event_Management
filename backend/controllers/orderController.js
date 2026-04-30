const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { estimatePackagePrice } = require('../utils/pricing');
const { dispatchOrderQuoted } = require('../services/inAppNotificationService');
const paymentService = require('../services/paymentService');

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
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'Invalid order id' });
  }

  const order = await prisma.eventOrder.findUnique({
    where: { id: orderId },
    include: { items: true, event: true },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  if (order.customerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const requirement = await paymentService.requireCompletedPaymentForEntity({
    entityType: 'order',
    entityId: order.id,
    userId: order.customerId,
  });

  if (requirement.required) {
    return res.status(402).json({
      message: 'Payment is required before placing this order',
      requiredPayment: true,
      entityType: 'order',
      entityId: order.id,
      config: requirement.config,
    });
  }

  const updated = await prisma.eventOrder.update({
    where: { id: order.id },
    data: { status: 'placed', finalTotal: order.quotedTotal },
  });

  // Create Booking records for each vendor in the order so they appear in the event's Vendors tab
  for (const item of order.items) {
    await prisma.booking.upsert({
      where: { eventId_vendorId: { eventId: order.eventId, vendorId: item.vendorId } },
      update: { price: item.quotedPrice },
      create: {
        eventId: order.eventId,
        vendorId: item.vendorId,
        organizerId: order.organizerId,
        price: item.quotedPrice,
        serviceDate: order.event.date,
        notes: `Order #${order.id} – ${item.packageTitle}`,
        status: 'confirmed',
      },
    });
  }

  const io = req.app.get('io');
  io.emit('order:placed', { orderId: updated.id, eventId: updated.eventId });

  res.json({ order: updated });
});

exports.getOrders = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.eventId) where.eventId = Number(req.query.eventId);

  if (req.user.role === 'admin') {
    // optional eventId filter only
  } else if (req.user.role === 'vendor') {
    const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (!vendor) {
      return res.json({ orders: [] });
    }
    where.items = { some: { vendorId: vendor.id } };
  } else if (req.user.role === 'customer' || req.user.role === 'organizer') {
    // Event owners often use role "customer"; include orders where they bought OR own the event.
    where.OR = [{ customerId: req.user.id }, { organizerId: req.user.id }];
  } else {
    return res.json({ orders: [] });
  }

  const orders = await prisma.eventOrder.findMany({
    where,
    include: { items: true, activities: true, event: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ orders });
});
