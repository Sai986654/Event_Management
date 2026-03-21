const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { uploadFile, deleteFile } = require('../services/fileService');
const { paginate } = require('../utils/pagination');
const { remoteBlessings } = require('../config/inviteConfig');

// POST /api/media
exports.uploadMedia = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  let url, publicId;
  try {
    const result = await uploadFile(req.file.buffer, `eventos/${req.body.event}`);
    url = result.url;
    publicId = result.publicId;
  } catch {
    url = `https://placeholder.eventos.dev/${Date.now()}-${req.file.originalname}`;
    publicId = null;
  }

  const media = await prisma.media.create({
    data: {
      eventId: Number(req.body.event),
      uploadedBy: req.user?.id || null,
      guestName: req.body.guestName,
      url,
      publicId,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'photo',
      caption: req.body.caption,
      isApproved: req.user ? true : false,
    },
  });

  res.status(201).json({ media });
});

// GET /api/media?event=:eventId
exports.getMedia = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};
  if (req.query.event) where.eventId = Number(req.query.event);
  if (req.query.type) where.type = req.query.type;
  if (req.query.approved !== undefined) where.isApproved = req.query.approved === 'true';

  const [media, total] = await Promise.all([
    prisma.media.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.media.count({ where }),
  ]);

  res.json({ media, page, totalPages: Math.ceil(total / limit), total });
});

// PUT /api/media/:id/approve
exports.approveMedia = asyncHandler(async (req, res) => {
  const media = await prisma.media.findUnique({ where: { id: Number(req.params.id) } });
  if (!media) return res.status(404).json({ message: 'Media not found' });

  const updated = await prisma.media.update({
    where: { id: media.id },
    data: { isApproved: true, isFlagged: false },
  });
  res.json({ media: updated });
});

// PUT /api/media/:id/flag
exports.flagMedia = asyncHandler(async (req, res) => {
  const media = await prisma.media.findUnique({ where: { id: Number(req.params.id) } });
  if (!media) return res.status(404).json({ message: 'Media not found' });

  const updated = await prisma.media.update({
    where: { id: media.id },
    data: { isFlagged: true, isApproved: false },
  });
  res.json({ media: updated });
});

// DELETE /api/media/:id
exports.deleteMedia = asyncHandler(async (req, res) => {
  const media = await prisma.media.findUnique({ where: { id: Number(req.params.id) } });
  if (!media) return res.status(404).json({ message: 'Media not found' });

  if (media.publicId) {
    await deleteFile(media.publicId).catch(() => {});
  }

  await prisma.media.delete({ where: { id: media.id } });
  res.json({ message: 'Media deleted' });
});

// POST /api/media/public-blessing
exports.uploadPublicBlessing = asyncHandler(async (req, res) => {
  if (!remoteBlessings.enabled) {
    return res.status(403).json({ message: 'Remote blessings upload is disabled' });
  }
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const event = await prisma.event.findFirst({
    where: { slug: req.body.eventSlug, isPublic: true },
    select: { id: true, title: true },
  });
  if (!event) {
    return res.status(404).json({ message: 'Public event not found' });
  }

  let url;
  let publicId;
  try {
    const result = await uploadFile(req.file.buffer, `eventos/public-blessings/${event.id}`);
    url = result.url;
    publicId = result.publicId;
  } catch {
    url = `https://placeholder.eventos.dev/${Date.now()}-${req.file.originalname}`;
    publicId = null;
  }

  const media = await prisma.media.create({
    data: {
      eventId: event.id,
      uploadedBy: null,
      guestName: req.body.guestName || 'Guest',
      url,
      publicId,
      type: req.file.mimetype.startsWith('video') ? 'video' : 'photo',
      caption: req.body.caption || `Remote blessing from ${req.body.guestName || 'Guest'}`,
      isApproved: remoteBlessings.autoApprove,
      isFlagged: false,
    },
  });

  res.status(201).json({
    media,
    ai: {
      status: 'queued',
      message: 'Photo received. AI will include this in the remote blessing collage set.',
    },
  });
});
