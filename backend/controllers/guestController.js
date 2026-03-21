const QRCode = require('qrcode');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const { sendEmail } = require('../services/notificationService');

// POST /api/guests
exports.addGuest = asyncHandler(async (req, res) => {
  const eventId = req.body.event ? Number(req.body.event) : Number(req.body.eventId);
  const guest = await prisma.guest.create({
    data: {
      eventId,
      name: req.body.name,
      email: req.body.email ? req.body.email.toLowerCase() : null,
      phone: req.body.phone,
      rsvpStatus: req.body.rsvpStatus,
      plusOnes: req.body.plusOnes,
      dietaryPreferences: req.body.dietaryPreferences,
      tableAssignment: req.body.tableAssignment,
    },
  });

  // Generate QR code containing guest ID for check-in
  const qrData = JSON.stringify({ guestId: guest.id, event: guest.eventId });
  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { qrCode: await QRCode.toDataURL(qrData) },
  });

  res.status(201).json({ guest: updated });
});

// POST /api/guests/bulk
exports.addGuestsBulk = asyncHandler(async (req, res) => {
  const { guests, event } = req.body;
  const eventId = Number(event);

  // createMany doesn't return records in Postgres, so use a transaction
  const created = await prisma.$transaction(
    guests.map((g) =>
      prisma.guest.create({
        data: { ...g, email: g.email ? g.email.toLowerCase() : null, eventId },
      })
    )
  );

  // Generate QR codes for each
  const updated = await Promise.all(
    created.map(async (guest) => {
      const qrData = JSON.stringify({ guestId: guest.id, event: guest.eventId });
      return prisma.guest.update({
        where: { id: guest.id },
        data: { qrCode: await QRCode.toDataURL(qrData) },
      });
    })
  );

  res.status(201).json({ guests: updated, count: updated.length });
});

// GET /api/guests?event=:eventId
exports.getGuests = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (req.query.event) where.eventId = Number(req.query.event);
  if (req.query.rsvpStatus) where.rsvpStatus = req.query.rsvpStatus;

  const [guests, total] = await Promise.all([
    prisma.guest.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.guest.count({ where }),
  ]);

  res.json({ guests, page, totalPages: Math.ceil(total / limit), total });
});

// PUT /api/guests/:id/rsvp  (public-friendly)
exports.updateRSVP = asyncHandler(async (req, res) => {
  const guest = await prisma.guest.findUnique({ where: { id: Number(req.params.id) } });
  if (!guest) return res.status(404).json({ message: 'Guest not found' });

  const data = { rsvpStatus: req.body.rsvpStatus };
  if (req.body.dietaryPreferences) data.dietaryPreferences = req.body.dietaryPreferences;
  if (req.body.plusOnes !== undefined) data.plusOnes = req.body.plusOnes;

  const updated = await prisma.guest.update({ where: { id: guest.id }, data });

  // Send RSVP confirmation
  if (updated.email) {
    await sendEmail({
      to: updated.email,
      subject: 'RSVP Confirmation - EventOS',
      html: `<p>Hi ${updated.name}, your RSVP status is now: <strong>${updated.rsvpStatus}</strong>.</p>`,
    });
  }

  req.app.get('io')?.to(`event-${updated.eventId}`).emit('guest:rsvp', {
    guestId: updated.id,
    rsvpStatus: updated.rsvpStatus,
  });

  res.json({ guest: updated });
});

// POST /api/guests/:id/checkin
exports.checkInGuest = asyncHandler(async (req, res) => {
  const guest = await prisma.guest.findUnique({ where: { id: Number(req.params.id) } });
  if (!guest) return res.status(404).json({ message: 'Guest not found' });

  if (guest.checkedIn) {
    return res.status(400).json({ message: 'Guest already checked in' });
  }

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { checkedIn: true, checkedInAt: new Date() },
  });

  req.app.get('io')?.to(`event-${updated.eventId}`).emit('guest:checkin', {
    guestId: updated.id,
    name: updated.name,
    checkedInAt: updated.checkedInAt,
  });

  res.json({ message: 'Guest checked in', guest: updated });
});

// POST /api/guests/scan  (QR code scan simulation)
exports.scanQR = asyncHandler(async (req, res) => {
  const { guestId } = req.body;
  const guest = await prisma.guest.findUnique({ where: { id: Number(guestId) } });
  if (!guest) return res.status(404).json({ message: 'Invalid QR code' });

  if (guest.checkedIn) {
    return res.json({ message: 'Already checked in', guest });
  }

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: { checkedIn: true, checkedInAt: new Date() },
  });

  req.app.get('io')?.to(`event-${updated.eventId}`).emit('guest:checkin', {
    guestId: updated.id,
    name: updated.name,
    checkedInAt: updated.checkedInAt,
  });

  res.json({ message: 'Check-in successful', guest: updated });
});

// DELETE /api/guests/:id
exports.deleteGuest = asyncHandler(async (req, res) => {
  const guest = await prisma.guest.findUnique({ where: { id: Number(req.params.id) } });
  if (!guest) return res.status(404).json({ message: 'Guest not found' });
  await prisma.guest.delete({ where: { id: guest.id } });
  res.json({ message: 'Guest removed' });
});
