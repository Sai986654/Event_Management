const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { startInviteJobProcessing, uploadToR2 } = require('../services/inviteVideoService');

/**
 * POST /api/invite-videos
 *
 * Multipart form-data:
 *   - images   (3-5 files)
 *   - music    (optional, 1 file)
 *   - guests   (JSON string: [{ name, phone }])
 *   - eventId  (number)
 */
exports.createInviteJob = asyncHandler(async (req, res) => {
  const { eventId, guests: guestsRaw } = req.body;

  // ── Validate eventId ──────────────────────────────────────
  if (!eventId) {
    return res.status(400).json({ message: 'eventId is required' });
  }

  const event = await prisma.event.findUnique({ where: { id: Number(eventId) } });
  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  // Event creator, organizer role, or admin
  if (event.organizerId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'organizer') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // ── Validate images ───────────────────────────────────────
  const images = req.files?.images;
  if (!images || images.length < 3 || images.length > 5) {
    return res.status(400).json({ message: '3 to 5 images are required' });
  }

  // ── Validate guests ───────────────────────────────────────
  let guests;
  try {
    guests = typeof guestsRaw === 'string' ? JSON.parse(guestsRaw) : guestsRaw;
  } catch {
    return res.status(400).json({ message: 'guests must be valid JSON' });
  }

  if (!Array.isArray(guests) || guests.length === 0) {
    return res.status(400).json({ message: 'At least one guest is required' });
  }

  for (const g of guests) {
    if (!g.name || !g.phone) {
      return res.status(400).json({ message: 'Each guest must have name and phone' });
    }
  }

  // ── Upload template images to R2 ─────────────────────────
  const templatePrefix = `templates/${eventId}`;
  const imageKeys = [];

  for (let i = 0; i < images.length; i++) {
    const file = images[i];
    const ext = (file.originalname || 'img.jpg').split('.').pop();
    const key = `${templatePrefix}/images/${Date.now()}-${i}.${ext}`;
    await uploadToR2(file.buffer, key, file.mimetype);
    imageKeys.push(key);
  }

  // ── Upload music to R2 (optional) ────────────────────────
  let musicKey = null;
  const musicFile = req.files?.music?.[0];
  if (musicFile) {
    musicKey = `${templatePrefix}/music.mp3`;
    await uploadToR2(musicFile.buffer, musicKey, musicFile.mimetype || 'audio/mpeg');
  }

  // ── Create job + guest records in DB ──────────────────────
  const job = await prisma.inviteJob.create({
    data: {
      eventId: Number(eventId),
      templateKey: templatePrefix,
      imageKeys,
      musicKey,
      totalGuests: guests.length,
      guestVideos: {
        create: guests.map((g) => ({
          guestName: g.name,
          phone: String(g.phone),
        })),
      },
    },
    include: { guestVideos: true },
  });

  // ── Enqueue background processing ────────────────────────
  const io = req.app.get('io');
  startInviteJobProcessing(job.id, io);

  // ── Return immediately ───────────────────────────────────
  res.status(202).json({
    eventId: Number(eventId),
    jobId: job.id,
    status: 'processing',
    totalGuests: guests.length,
    message: 'Invite video generation started. Track progress via GET /api/invite-videos/:jobId',
  });
});

/**
 * GET /api/invite-videos/:jobId
 *
 * Returns job status and per-guest progress.
 */
exports.getInviteJob = asyncHandler(async (req, res) => {
  const job = await prisma.inviteJob.findUnique({
    where: { id: Number(req.params.jobId) },
    include: {
      guestVideos: {
        select: {
          id: true,
          guestName: true,
          phone: true,
          status: true,
          videoUrl: true,
          messageSent: true,
          error: true,
          retries: true,
        },
      },
    },
  });

  if (!job) {
    return res.status(404).json({ message: 'Job not found' });
  }

  // Auth check — event creator, organizer role, or admin
  const event = await prisma.event.findUnique({ where: { id: job.eventId } });
  if (event.organizerId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'organizer') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  res.json({
    jobId: job.id,
    eventId: job.eventId,
    status: job.status,
    totalGuests: job.totalGuests,
    processed: job.processed,
    failed: job.failed,
    error: job.error,
    guests: job.guestVideos,
    createdAt: job.createdAt,
  });
});

/**
 * GET /api/invite-videos/event/:eventId
 *
 * List all invite jobs for an event.
 */
exports.getJobsByEvent = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'organizer') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const jobs = await prisma.inviteJob.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { guestVideos: true } },
    },
  });

  res.json({ jobs });
});

/**
 * POST /api/invite-videos/:jobId/retry
 *
 * Retry failed guests in a job.
 */
exports.retryFailedGuests = asyncHandler(async (req, res) => {
  const jobId = Number(req.params.jobId);

  const job = await prisma.inviteJob.findUnique({
    where: { id: jobId },
    include: { event: { select: { organizerId: true } } },
  });
  if (!job) return res.status(404).json({ message: 'Job not found' });
  if (job.event.organizerId !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'organizer') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // Reset failed guests to pending
  const { count } = await prisma.inviteGuestVideo.updateMany({
    where: { jobId, status: 'failed' },
    data: { status: 'pending', retries: 0, error: null },
  });

  if (count === 0) {
    return res.json({ message: 'No failed guests to retry' });
  }

  // Reset job status
  await prisma.inviteJob.update({
    where: { id: jobId },
    data: { status: 'pending', failed: 0 },
  });

  // Re-enqueue
  const io = req.app.get('io');
  startInviteJobProcessing(jobId, io);

  res.json({ message: `${count} guest(s) queued for retry`, jobId });
});
