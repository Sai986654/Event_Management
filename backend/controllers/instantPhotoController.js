const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { uploadFile } = require('../services/fileService');

// ── Photographer uploads a photo for an event ─────────────────────────
// POST /api/instant-photos/upload  (auth: organizer/admin/vendor)
exports.uploadInstantPhoto = asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const eventId = Number(req.body.eventId);
  if (!eventId) return res.status(400).json({ message: 'eventId is required' });

  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true } });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  let url, publicId;
  try {
    const result = await uploadFile(req.file.buffer, `vedika360/live/${eventId}`, {
      contentType: req.file.mimetype,
    });
    url = result.url;
    publicId = result.publicId;
  } catch (err) {
    console.error('[InstantPhoto] Upload failed:', err.message);
    return res.status(502).json({ message: 'File upload failed' });
  }

  const photo = await prisma.instantPhoto.create({
    data: {
      eventId,
      url,
      publicId,
      caption: req.body.caption || null,
      uploadedBy: req.user?.id || null,
    },
  });

  // Push real-time to all guests viewing the live wall
  const io = req.app.get('io');
  io.to(`live-photos-${eventId}`).emit('live-photo:new', { photo });

  res.status(201).json({ photo });
});

// ── Public: get last N photos for an event ────────────────────────────
// GET /api/instant-photos/live/:eventId  (public — no auth)
exports.getLivePhotos = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));

  const photos = await prisma.instantPhoto.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, date: true, venue: true },
  });

  res.json({ photos, event });
});
