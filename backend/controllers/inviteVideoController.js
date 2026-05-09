const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { startInviteJobProcessing, uploadToR2, buildInviteStorageKey } = require('../services/inviteVideoService');

function fileExtension(file, fallback) {
  const fromName = String(file?.originalname || '').split('.').pop() || '';
  const fromType = String(file?.mimetype || '').split('/').pop() || '';
  const ext = (fromName || fromType || fallback || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ext || fallback;
}

function parseMaybeJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeManifestTemplate(template) {
  return template?.palette?.__adobeExpress || null;
}

function formatEventDate(eventDate) {
  if (!eventDate) return '';
  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatEventTime(eventDate) {
  if (!eventDate) return '';
  const date = new Date(eventDate);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function resolveManifestFieldValue(fieldId, event) {
  const map = {
    eventTitle: event?.title || '',
    guestName: 'Guest',
    brideName: event?.customerPreferences?.brideName || event?.title || '',
    groomName: event?.customerPreferences?.groomName || '',
    eventDate: formatEventDate(event?.date),
    eventTime: formatEventTime(event?.date),
    venueName: event?.venue || '',
    venue: event?.venue || '',
    eventAddress: event?.address || event?.venue || '',
    customMessage: event?.description || 'We would be delighted to have you with us',
    hostLine: event?.description ? `Hosted with love for ${event.title}` : 'Hosted with love',
    dressCode: '',
    programHighlight: '',
    hashtag: '',
    seatingInfo: '',
    rsvpLink: '',
    mapLink: '',
  };

  return map[fieldId] || '';
}

function normalizeSceneTextStyle(style = {}) {
  if (!style || typeof style !== 'object') return {};

  return {
    fontSize: Number(style.fontSize) || undefined,
    color: style.color || undefined,
    lineHeight: Number(style.lineHeight) || undefined,
    backgroundColor: style.backgroundColor || undefined,
    backgroundOpacity: typeof style.backgroundOpacity === 'number' ? style.backgroundOpacity : undefined,
    borderColor: style.borderColor || undefined,
    borderWidth: typeof style.borderWidth === 'number' ? style.borderWidth : undefined,
    shadowColor: style.shadowColor || undefined,
    shadowOffsetX: typeof style.shadowOffsetX === 'number' ? style.shadowOffsetX : undefined,
    shadowOffsetY: typeof style.shadowOffsetY === 'number' ? style.shadowOffsetY : undefined,
    shadowOpacity: typeof style.shadowOpacity === 'number' ? style.shadowOpacity : undefined,
    strokeColor: style.strokeColor || undefined,
    strokeWidth: typeof style.strokeWidth === 'number' ? style.strokeWidth : undefined,
    padding: typeof style.padding === 'number' ? style.padding : undefined,
    opacity: typeof style.opacity === 'number' ? style.opacity : undefined,
  };
}

function buildScenePayloadsFromManifest(manifest, event) {
  const timeline = Array.isArray(manifest?.timeline) ? manifest.timeline : [];
  return timeline
    .map((scene, index) => {
      if (!scene) return null;
      const assetKey = String(scene.baseVideo || scene.baseImage || scene.background || scene.assetPath || scene.image || '').trim();
      if (!assetKey) return null;

      const durationMs = Number(scene.durationMs || scene.duration || 0) || 3500;
      const sceneDurationSeconds = Math.max(1.5, Math.min(12, durationMs / 1000));
      const texts = Array.isArray(scene.textLayers)
        ? scene.textLayers
            .map((layer) => {
              if (!layer || !layer.fieldId) return null;
              const value = resolveManifestFieldValue(layer.fieldId, event);
              if (!String(value || '').trim()) return null;

              return {
                value: String(value),
                start: 0,
                duration: sceneDurationSeconds,
                x: typeof layer.x === 'number' ? layer.x : 0.5,
                y: typeof layer.y === 'number' ? layer.y : 0.5,
                maxWidth: typeof layer.maxWidth === 'number' ? layer.maxWidth : 0.82,
                maxHeight: typeof layer.maxHeight === 'number' ? layer.maxHeight : 0.08,
                align: layer.align || 'center',
                style: normalizeSceneTextStyle(layer.style),
              };
            })
            .filter(Boolean)
        : [];

      return {
        sceneId: scene.sceneId || `scene-${index + 1}`,
        key: assetKey,
        durationMs,
        texts,
      };
    })
    .filter(Boolean);
}

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
  const { eventId, guests: guestsRaw, voiceTemplate, voiceLang } = req.body;
  const manifestPayload = parseMaybeJson(req.body.manifest);
  const templateId = req.body.templateId !== undefined ? Number(req.body.templateId) : null;
  const templateKey = req.body.templateKey ? String(req.body.templateKey).trim() : '';

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

  let adobeTemplate = null;
  if (!manifestPayload && (templateId || templateKey)) {
    adobeTemplate = await prisma.inviteTemplate.findFirst({
      where: templateId ? { id: templateId } : { key: templateKey },
    });

    if (!adobeTemplate) {
      return res.status(404).json({ message: 'Invite template not found' });
    }
  }

  const manifest = manifestPayload || normalizeManifestTemplate(adobeTemplate);
  const manifestScenes = buildScenePayloadsFromManifest(manifest, event);

  // ── Validate images ───────────────────────────────────────
  const images = req.files?.images;
  if (!manifestScenes.length && (!images || images.length < 3 || images.length > 5)) {
    return res.status(400).json({ message: '3 to 5 images are required or provide a manifest with timeline scenes' });
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

  // ── Upload template images to R2 or use manifest scene assets ─
  const requestId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const templatePrefix = `invites/events/event-${Number(eventId)}/req-${requestId}/template`;
  const imageKeys = [];

  if (manifestScenes.length > 0) {
    for (const scene of manifestScenes) {
      imageKeys.push(scene);
    }
  } else {
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const ext = fileExtension(file, 'jpg');
      const key = buildInviteStorageKey({
        eventId: Number(eventId),
        requestId,
        mediaGroup: 'template-images',
        mediaKind: 'image',
        extension: ext,
        index: i,
      });
      await uploadToR2(file.buffer, key, file.mimetype);
      imageKeys.push(key);
    }
  }

  // ── Upload music to R2 (optional) ────────────────────────
  let musicKey = null;
  const musicFile = req.files?.music?.[0];
  if (musicFile) {
    musicKey = buildInviteStorageKey({
      eventId: Number(eventId),
      requestId,
      mediaGroup: 'template-music',
      mediaKind: 'audio',
      extension: fileExtension(musicFile, 'mp3'),
    });
    await uploadToR2(musicFile.buffer, musicKey, musicFile.mimetype || 'audio/mpeg');
  }

  // ── Create job + guest records in DB ──────────────────────
  const job = await prisma.inviteJob.create({
    data: {
      eventId: Number(eventId),
      templateKey: manifest?.templateKey || adobeTemplate?.key || templatePrefix,
      imageKeys,
      musicKey,
      voiceTemplate: voiceTemplate || null,
      voiceLang: voiceLang || 'en',
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
