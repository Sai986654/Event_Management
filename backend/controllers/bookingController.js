const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const { sendEmail } = require('../services/notificationService');
const { dispatchBookingCreated } = require('../services/inAppNotificationService');
const paymentService = require('../services/paymentService');

// POST /api/bookings
exports.createBooking = asyncHandler(async (req, res) => {
  const { event, vendor, price, serviceDate, notes } = req.body;

  const vendorDoc = await prisma.vendor.findUnique({ where: { id: Number(vendor) } });
  if (!vendorDoc) return res.status(404).json({ message: 'Vendor not found' });

  const booking = await prisma.booking.create({
    data: {
      eventId: Number(event),
      vendorId: Number(vendor),
      organizerId: req.user.id,
      price,
      serviceDate: new Date(serviceDate),
      notes,
    },
  });

  await sendEmail({
    to: req.user.email,
    subject: 'Booking Confirmation - Vedika 360',
    html: `<p>Your booking with vendor has been created. Status: pending.</p>`,
  });

  const io = req.app.get('io');
  io?.to(`event-${event}`).emit('booking:created', booking);
  const creator = await prisma.user.findUnique({ where: { id: req.user.id } });
  await dispatchBookingCreated(io, booking, { creatorUser: creator }).catch((err) =>
    console.error('[BookingCreate] notifications', err.message)
  );

  res.status(201).json({ booking });
});

// GET /api/bookings
exports.getBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};

  if (req.query.event) where.eventId = Number(req.query.event);

  // Filter bookings by role so users only see their own
  if (req.user.role === 'organizer' || req.user.role === 'customer') {
    where.organizerId = req.user.id;
  } else if (req.user.role === 'vendor') {
    const vendorProfile = await prisma.vendor.findUnique({ where: { userId: req.user.id } });
    if (vendorProfile) where.vendorId = vendorProfile.id;
    else return res.json({ bookings: [], page: 1, totalPages: 0, total: 0 });
  } else if (req.user.role === 'guest') {
    where.organizerId = req.user.id;
  }
  // admin sees all bookings (no extra filter)

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        event: { select: { id: true, title: true, date: true } },
        vendor: { select: { id: true, businessName: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.booking.count({ where }),
  ]);

  res.json({ bookings, page, totalPages: Math.ceil(total / limit), total });
});

// PUT /api/bookings/:id/status
exports.updateBookingStatus = asyncHandler(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  // Ownership check: only the organizer, the vendor, or admin can update
  const isOrganizer = booking.organizerId === req.user.id;
  const isVendor = await prisma.vendor.findFirst({
    where: { id: booking.vendorId, userId: req.user.id },
  });
  if (!isOrganizer && !isVendor && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized to update this booking' });
  }

  const nextStatus = String(req.body.status || '').toLowerCase();
  if (nextStatus === 'confirmed') {
    const requirement = await paymentService.requireCompletedPaymentForEntity({
      entityType: 'booking',
      entityId: booking.id,
      userId: booking.organizerId,
    });

    if (requirement.required) {
      return res.status(402).json({
        message: 'Payment is required before confirming this booking',
        requiredPayment: true,
        entityType: 'booking',
        entityId: booking.id,
        config: requirement.config,
      });
    }
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: req.body.status },
  });

  req.app.get('io')?.to(`event-${updated.eventId}`).emit('booking:updated', updated);

  res.json({ booking: updated });
});

// DELETE /api/bookings/:id
exports.deleteBooking = asyncHandler(async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { id: Number(req.params.id) } });
  if (!booking) return res.status(404).json({ message: 'Booking not found' });

  if (booking.organizerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await prisma.booking.delete({ where: { id: booking.id } });
  res.json({ message: 'Booking deleted' });
});
