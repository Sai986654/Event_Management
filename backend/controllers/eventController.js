const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const slugify = require('slugify');
const QRCode = require('qrcode');
const { gifting, inviteCopy } = require('../config/inviteConfig');
const { dispatchEventCreated } = require('../services/inAppNotificationService');
const { triggerInviteDripForEventId } = require('../services/inviteDripService');
const { deployEventToNetlify } = require('../services/netlifySiteService');

const generateSlug = (title) =>
  slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

const resolveShareDestination = (event, origin) => {
  const internalPublicUrl = event?.isPublic && event?.slug ? `${origin}/public/${event.slug}` : '';
  const netlifyUrl = event?.netlifySiteUrl || '';
  const preference = String(event?.qrDestinationType || 'auto').toLowerCase();

  if (preference === 'netlify') return netlifyUrl || internalPublicUrl || '';
  if (preference === 'public') return internalPublicUrl || netlifyUrl || '';
  return netlifyUrl || internalPublicUrl || '';
};

const buildSharePayload = async (event, origin) => {
  const shareDestinationUrl = resolveShareDestination(event, origin);
  const shareQrCodeDataUrl = shareDestinationUrl ? await QRCode.toDataURL(shareDestinationUrl) : null;

  return { shareDestinationUrl, shareQrCodeDataUrl };
};

// POST /api/events
exports.createEvent = asyncHandler(async (req, res) => {
  const { concernedVendorIds, ...raw } = req.body;
  const vendorIds = Array.isArray(concernedVendorIds) ? concernedVendorIds : [];

  const data = {
    title: raw.title,
    type: raw.type,
    description: raw.description,
    date: raw.date != null ? new Date(raw.date) : undefined,
    endDate: raw.endDate != null ? new Date(raw.endDate) : undefined,
    venue: raw.venue,
    address: raw.address,
    city: raw.city,
    state: raw.state,
    lat: raw.lat,
    lng: raw.lng,
    budget: raw.budget != null ? raw.budget : undefined,
    guestCount: raw.guestCount != null ? raw.guestCount : undefined,
    status: raw.status,
    coverImage: raw.coverImage,
    isPublic: raw.isPublic,
    sectorCustomizations: raw.sectorCustomizations,
    customerPreferences: raw.customerPreferences,
    qrDestinationType: raw.qrDestinationType,
    timeline: raw.timeline,
    tasks: raw.tasks,
    organizerId: req.user.id,
    slug: generateSlug(raw.title),
  };

  Object.keys(data).forEach((k) => data[k] === undefined && delete data[k]);

  const event = await prisma.event.create({ data });

  const creator = await prisma.user.findUnique({ where: { id: req.user.id } });
  const io = req.app.get('io');
  await dispatchEventCreated(io, event, creator, vendorIds).catch((err) =>
    console.error('[EventCreate] notifications', err.message)
  );

  res.status(201).json({ event });
});

// GET /api/events
exports.getEvents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};

  if (req.user.role === 'customer') {
    where.organizerId = req.user.id;
  }
  if (req.query.status) where.status = req.query.status;
  if (req.query.type) where.type = req.query.type;

  const [events, total] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: limit,
    }),
    prisma.event.count({ where }),
  ]);

  res.json({ events, page, totalPages: Math.ceil(total / limit), total });
});

// GET /api/events/:id
exports.getEvent = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: Number(req.params.id) },
    include: { organizer: { select: { id: true, name: true, email: true } } },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  const origin = process.env.CLIENT_URL || req.get('origin') || 'http://localhost:3000';
  const sharePayload = await buildSharePayload(event, origin);

  res.json({ event, inviteCopy, ...sharePayload });
});

// GET /api/events/slug/:slug  (public)
exports.getEventBySlug = asyncHandler(async (req, res) => {
  const event = await prisma.event.findFirst({
    where: { slug: req.params.slug, isPublic: true },
    include: { organizer: { select: { id: true, name: true } } },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  let gift = { enabled: false };
  if (gifting.enabled && gifting.upiId) {
    const upiLink = `upi://pay?pa=${encodeURIComponent(gifting.upiId)}&pn=${encodeURIComponent(gifting.payeeName)}&tn=${encodeURIComponent(gifting.defaultNote)}`;
    const qrCodeDataUrl = await QRCode.toDataURL(upiLink);
    gift = {
      enabled: true,
      upiLink,
      upiId: gifting.upiId,
      payeeName: gifting.payeeName,
      note: gifting.defaultNote,
      qrCodeDataUrl,
    };
  }

  res.json({ event, gift, inviteCopy });
});

// PUT /api/events/:id
exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const data = { ...req.body };

  if (data.date != null) data.date = new Date(data.date);
  if (data.endDate != null) data.endDate = new Date(data.endDate);
  if (data.title && data.title !== event.title) {
    data.slug = generateSlug(data.title);
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data,
  });
  res.json({ event: updated });
});

// DELETE /api/events/:id
exports.deleteEvent = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await prisma.event.delete({ where: { id: event.id } });
  res.json({ message: 'Event deleted' });
});

// PUT /api/events/:id/tasks
exports.updateTasks = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { tasks: req.body.tasks },
  });
  res.json({ tasks: updated.tasks });
});

// PUT /api/events/:id/timeline
exports.updateTimeline = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { timeline: req.body.timeline },
  });
  res.json({ timeline: updated.timeline });
});

// PUT /api/events/:id/share-settings
exports.updateShareSettings = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (!['admin', 'organizer'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only organizers/admin can update share settings' });
  }

  const qrDestinationType = String(req.body?.qrDestinationType || 'auto').toLowerCase();
  if (!['auto', 'netlify', 'public'].includes(qrDestinationType)) {
    return res.status(400).json({ message: 'Invalid qrDestinationType' });
  }

  const updated = await prisma.event.update({
    where: { id: eventId },
    data: { qrDestinationType },
  });

  const origin = process.env.CLIENT_URL || req.get('origin') || 'http://localhost:3000';
  const sharePayload = await buildSharePayload(updated, origin);

  res.json({ event: updated, ...sharePayload });
});

// POST /api/events/:id/invite-drip/trigger — test or force-send scheduled WhatsApp drip (organizer/admin)
exports.triggerInviteDrip = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (req.user.role !== 'admin' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  const force = req.query.force === '1' || req.body?.force === true;
  const result = await triggerInviteDripForEventId(eventId, { force });
  if (result.error) {
    const status = result.code === 'INTERVAL' ? 409 : 400;
    return res.status(status).json(result);
  }
  res.json(result);
});

// POST /api/events/:id/publish-netlify
exports.publishEventNetlify = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.id);
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  // Product requirement: organizers can publish event microsites even for customer-created events.
  if (!['admin', 'organizer'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only organizers/admin can publish microsites' });
  }

  // Fetch approved event photos for the microsite gallery
  const media = await prisma.media.findMany({
    where: { eventId, type: 'photo', isApproved: true },
    select: { url: true },
    orderBy: { createdAt: 'desc' },
    take: 12,
  });
  const mediaUrls = media.map((m) => m.url);

  try {
    const deployed = await deployEventToNetlify(event, mediaUrls);

    const updated = await prisma.event.update({
      where: { id: eventId },
      data: {
        isPublic: true,
        netlifySiteId: deployed.siteId,
        netlifySiteUrl: deployed.siteUrl,
        netlifyPublishedAt: new Date(),
      },
    });

    const origin = process.env.CLIENT_URL || req.get('origin') || 'http://localhost:3000';
    const sharePayload = await buildSharePayload(updated, origin);

    res.status(201).json({
      event: updated,
      ...sharePayload,
      site: deployed,
      message: 'Event microsite published on Netlify',
    });
  } catch (err) {
    res.status(502).json({
      message: 'Failed to publish Netlify microsite',
      detail: err.message,
    });
  }
});
