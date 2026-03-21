const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const slugify = require('slugify');
const QRCode = require('qrcode');
const { gifting } = require('../config/inviteConfig');

const generateSlug = (title) =>
  slugify(title, { lower: true, strict: true }) + '-' + Date.now().toString(36);

// POST /api/events
exports.createEvent = asyncHandler(async (req, res) => {
  const event = await prisma.event.create({
    data: {
      ...req.body,
      organizerId: req.user.id,
      slug: generateSlug(req.body.title),
    },
  });
  res.status(201).json({ event });
});

// GET /api/events
exports.getEvents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};

  if (req.user.role === 'organizer' || req.user.role === 'customer') {
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
  res.json({ event });
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

  res.json({ event, gift });
});

// PUT /api/events/:id
exports.updateEvent = asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({ where: { id: Number(req.params.id) } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (event.organizerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const data = { ...req.body };
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
