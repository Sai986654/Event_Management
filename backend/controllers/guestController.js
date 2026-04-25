const QRCode = require('qrcode');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const { sendEmail } = require('../services/notificationService');
const { generatePersonalizedInvite, listInviteTemplates } = require('../services/personalizedInviteService');

const canManageEventGuests = (event, user) =>
  !!event && (event.organizerId === user.id || user.role === 'admin' || user.role === 'organizer');

const resolveClientBaseUrl = (req) =>
  process.env.CLIENT_URL || req.get('origin') || 'http://localhost:3000';

// POST /api/guests
exports.addGuest = asyncHandler(async (req, res) => {
  const eventId = req.body.event ? Number(req.body.event) : Number(req.body.eventId);
  const guest = await prisma.guest.create({
    data: {
      eventId,
      name: req.body.name,
      email: req.body.email ? req.body.email.toLowerCase() : null,
      phone: req.body.phone,
      relationship: req.body.relationship || req.body.relation || null,
      inviteTone: req.body.inviteTone || req.body.tone || null,
      inviteLanguage: req.body.inviteLanguage || req.body.language || 'en',
      inviteTemplateKey: req.body.inviteTemplateKey || req.body.templateKey || null,
      customInviteMessage: req.body.customInviteMessage || req.body.customMessage || null,
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
        data: {
          ...g,
          email: g.email ? g.email.toLowerCase() : null,
          relationship: g.relationship || g.relation || null,
          inviteTone: g.inviteTone || g.tone || null,
          inviteLanguage: g.inviteLanguage || g.language || 'en',
          inviteTemplateKey: g.inviteTemplateKey || g.templateKey || null,
          customInviteMessage: g.customInviteMessage || g.customMessage || null,
          eventId,
        },
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
      subject: 'RSVP Confirmation - Vedika 360',
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

// GET /api/guests/invite-templates
exports.getInviteTemplates = asyncHandler(async (_req, res) => {
  res.json({ templates: listInviteTemplates() });
});

// GET /api/guests/:id/personalized-invite
exports.getPersonalizedInvite = asyncHandler(async (req, res) => {
  const guest = await prisma.guest.findUnique({
    where: { id: Number(req.params.id) },
    include: { event: { select: { id: true, organizerId: true, title: true, slug: true } } },
  });

  if (!guest) return res.status(404).json({ message: 'Guest not found' });
  if (!canManageEventGuests(guest.event, req.user)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  res.json({
    guestId: guest.id,
    eventId: guest.eventId,
    inviteToken: guest.inviteToken,
    relationship: guest.relationship,
    inviteTone: guest.inviteTone,
    inviteLanguage: guest.inviteLanguage,
    inviteTemplateKey: guest.inviteTemplateKey,
    customInviteMessage: guest.customInviteMessage,
    personalizedInviteMessage: guest.personalizedInviteMessage,
    personalizedInvitePdfUrl: guest.personalizedInvitePdfUrl,
    invitationGeneratedAt: guest.invitationGeneratedAt,
  });
});

// POST /api/guests/:id/personalized-invite/generate
exports.generatePersonalizedInviteForGuest = asyncHandler(async (req, res) => {
  const guest = await prisma.guest.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      event: {
        select: {
          id: true,
          title: true,
          date: true,
          venue: true,
          slug: true,
          organizerId: true,
        },
      },
    },
  });

  if (!guest) return res.status(404).json({ message: 'Guest not found' });
  if (!canManageEventGuests(guest.event, req.user)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const generated = await generatePersonalizedInvite({
    guest,
    event: guest.event,
    clientBaseUrl: resolveClientBaseUrl(req),
    payload: {
      relationship: req.body.relationship || req.body.relation,
      tone: req.body.tone || req.body.inviteTone,
      language: req.body.language || req.body.inviteLanguage,
      templateKey: req.body.templateKey || req.body.inviteTemplateKey,
      customMessage: req.body.customMessage || req.body.customInviteMessage,
      memoryNote: req.body.memoryNote,
    },
  });

  const updated = await prisma.guest.update({
    where: { id: guest.id },
    data: {
      relationship: generated.relationship,
      inviteTone: generated.inviteTone,
      inviteLanguage: generated.inviteLanguage,
      inviteTemplateKey: generated.inviteTemplateKey,
      customInviteMessage: generated.customInviteMessage,
      personalizedInviteMessage: generated.inviteMessage,
      personalizedInvitePdfUrl: generated.personalizedInvitePdfUrl,
      personalizedInvitePdfKey: generated.personalizedInvitePdfKey,
      inviteToken: generated.inviteToken,
      invitationGeneratedAt: new Date(),
      qrCode: generated.qrCodeDataUrl,
    },
  });

  res.json({
    guest: updated,
    invite: {
      message: generated.inviteMessage,
      inviteUrl: generated.inviteUrl,
      pdfUrl: generated.personalizedInvitePdfUrl,
      language: generated.inviteLanguage,
      tone: generated.inviteTone,
      templateKey: generated.inviteTemplateKey,
      templateName: generated.templateName,
      relationship: generated.relationship,
    },
  });
});

// POST /api/guests/personalized-invites/generate-bulk
exports.generatePersonalizedInvitesBulk = asyncHandler(async (req, res) => {
  const eventId = Number(req.body.eventId || req.body.event);
  if (!eventId) {
    return res.status(400).json({ message: 'eventId is required' });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, date: true, venue: true, slug: true, organizerId: true },
  });

  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (!canManageEventGuests(event, req.user)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const guestIds = Array.isArray(req.body.guestIds)
    ? req.body.guestIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];

  const guests = await prisma.guest.findMany({
    where: {
      eventId,
      ...(guestIds.length ? { id: { in: guestIds } } : {}),
    },
    orderBy: { name: 'asc' },
  });

  if (!guests.length) {
    return res.status(404).json({ message: 'No guests found for generation' });
  }

  const successes = [];
  const failures = [];
  const clientBaseUrl = resolveClientBaseUrl(req);

  for (const guest of guests) {
    try {
      const generated = await generatePersonalizedInvite({
        guest,
        event,
        clientBaseUrl,
        payload: {
          tone: req.body.defaultTone,
          language: req.body.defaultLanguage,
          templateKey: req.body.defaultTemplateKey,
        },
      });

      await prisma.guest.update({
        where: { id: guest.id },
        data: {
          relationship: generated.relationship,
          inviteTone: generated.inviteTone,
          inviteLanguage: generated.inviteLanguage,
          inviteTemplateKey: generated.inviteTemplateKey,
          customInviteMessage: generated.customInviteMessage,
          personalizedInviteMessage: generated.inviteMessage,
          personalizedInvitePdfUrl: generated.personalizedInvitePdfUrl,
          personalizedInvitePdfKey: generated.personalizedInvitePdfKey,
          inviteToken: generated.inviteToken,
          invitationGeneratedAt: new Date(),
          qrCode: generated.qrCodeDataUrl,
        },
      });

      successes.push({
        guestId: guest.id,
        name: guest.name,
        pdfUrl: generated.personalizedInvitePdfUrl,
        inviteUrl: generated.inviteUrl,
        templateKey: generated.inviteTemplateKey,
        templateName: generated.templateName,
      });
    } catch (error) {
      failures.push({
        guestId: guest.id,
        name: guest.name,
        error: error.message,
      });
    }
  }

  res.json({
    eventId,
    total: guests.length,
    generated: successes.length,
    failed: failures.length,
    invites: successes,
    failures,
  });
});
