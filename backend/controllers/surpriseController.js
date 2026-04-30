const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const slugify = require('slugify');
const crypto = require('crypto');
const { deploySurprisePage } = require('../services/surpriseDeployService');
const paymentService = require('../services/paymentService');

const generateSlug = (title) =>
  slugify(title, { lower: true, strict: true }) + '-' + crypto.randomBytes(4).toString('hex');

// ── Templates ─────────────────────────────────────────────────────

exports.getTemplates = asyncHandler(async (req, res) => {
  const { category, tier } = req.query;
  const where = { isActive: true };
  if (category) where.category = category;
  if (tier) where.tier = tier;

  const templates = await prisma.surpriseTemplate.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });

  res.json({ templates });
});

exports.getTemplate = asyncHandler(async (req, res) => {
  const template = await prisma.surpriseTemplate.findUnique({
    where: { id: parseInt(req.params.id) },
  });
  if (!template) return res.status(404).json({ message: 'Template not found' });
  res.json({ template });
});

// ── Surprise Pages (CRUD) ─────────────────────────────────────────

exports.createSurprisePage = asyncHandler(async (req, res) => {
  const {
    templateId, title, category, recipientName, senderName,
    steps, photos, musicUrl, videoUrl, voiceMessageUrl,
    finalMessage, theme, scheduledAt, expiresAt, tier, password,
  } = req.body;

  const page = await prisma.surprisePage.create({
    data: {
      userId: req.user.id,
      templateId: templateId || null,
      title,
      slug: generateSlug(title || 'surprise'),
      category: category || 'proposal',
      recipientName,
      senderName,
      steps: steps || [],
      photos: photos || [],
      musicUrl,
      videoUrl,
      voiceMessageUrl,
      finalMessage,
      theme: theme || {},
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      tier: tier || 'free',
      password: password || null,
      status: 'draft',
    },
    include: { template: true },
  });

  res.status(201).json({ page });
});

exports.getMySurprisePages = asyncHandler(async (req, res) => {
  const { page: pg, limit } = paginate(req.query.page, req.query.limit);
  const { skip } = paginate(req.query.page, req.query.limit);

  const [pages, total] = await Promise.all([
    prisma.surprisePage.findMany({
      where: { userId: req.user.id },
      include: { template: { select: { name: true, previewImage: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.surprisePage.count({ where: { userId: req.user.id } }),
  ]);

  res.json({ pages, total, page: pg, limit });
});

exports.getSurprisePage = asyncHandler(async (req, res) => {
  const page = await prisma.surprisePage.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { template: true, _count: { select: { interactions: true } } },
  });
  if (!page) return res.status(404).json({ message: 'Surprise page not found' });
  if (page.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }
  res.json({ page });
});

exports.updateSurprisePage = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.surprisePage.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (existing.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const {
    title, category, recipientName, senderName, steps, photos,
    musicUrl, videoUrl, voiceMessageUrl, finalMessage, theme,
    scheduledAt, expiresAt, status, tier, password,
  } = req.body;

  const data = {};
  if (title !== undefined) data.title = title;
  if (category !== undefined) data.category = category;
  if (recipientName !== undefined) data.recipientName = recipientName;
  if (senderName !== undefined) data.senderName = senderName;
  if (steps !== undefined) data.steps = steps;
  if (photos !== undefined) data.photos = photos;
  if (musicUrl !== undefined) data.musicUrl = musicUrl;
  if (videoUrl !== undefined) data.videoUrl = videoUrl;
  if (voiceMessageUrl !== undefined) data.voiceMessageUrl = voiceMessageUrl;
  if (finalMessage !== undefined) data.finalMessage = finalMessage;
  if (theme !== undefined) data.theme = theme;
  if (scheduledAt !== undefined) data.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (status !== undefined) data.status = status;
  if (tier !== undefined) data.tier = tier;
  if (password !== undefined) data.password = password;

  const page = await prisma.surprisePage.update({
    where: { id },
    data,
    include: { template: true },
  });

  res.json({ page });
});

exports.deleteSurprisePage = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.surprisePage.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (existing.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  await prisma.surprisePage.delete({ where: { id } });
  res.json({ message: 'Surprise page deleted' });
});

// ── Public Viewer (no auth) ───────────────────────────────────────

exports.viewSurpriseBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const page = await prisma.surprisePage.findUnique({
    where: { slug },
    include: { template: { select: { name: true, steps: true, defaultMusic: true } } },
  });

  if (!page) return res.status(404).json({ message: 'Surprise page not found' });
  if (page.status === 'disabled') return res.status(410).json({ message: 'This page has been disabled' });
  if (page.status === 'expired' || (page.expiresAt && new Date() > page.expiresAt)) {
    return res.status(410).json({ message: 'This surprise has expired' });
  }
  if (page.scheduledAt && new Date() < page.scheduledAt) {
    return res.json({
      scheduled: true,
      scheduledAt: page.scheduledAt,
      message: 'This surprise is scheduled for later. Come back soon!',
    });
  }

  // Check password if set
  if (page.password) {
    const provided = req.query.password || req.headers['x-surprise-password'];
    if (provided !== page.password) {
      return res.json({
        passwordRequired: true,
        title: page.title,
        recipientName: page.recipientName,
      });
    }
  }

  // Increment view count
  await prisma.surprisePage.update({
    where: { id: page.id },
    data: { viewCount: { increment: 1 } },
  });

  // Return public-safe data (no userId, no password)
  const { userId, password: _pw, ...publicPage } = page;
  res.json({ page: publicPage });
});

// ── Interaction Tracking (no auth) ────────────────────────────────

exports.trackInteraction = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { sessionId, stepReached, completed, reaction } = req.body;

  const page = await prisma.surprisePage.findUnique({ where: { slug } });
  if (!page) return res.status(404).json({ message: 'Not found' });

  const deviceInfo = req.headers['user-agent']?.substring(0, 200);

  await prisma.surpriseInteraction.create({
    data: {
      surprisePageId: page.id,
      sessionId: sessionId || crypto.randomBytes(8).toString('hex'),
      stepReached: stepReached || 0,
      completed: completed || false,
      reaction: reaction || null,
      deviceInfo,
    },
  });

  if (completed) {
    await prisma.surprisePage.update({
      where: { id: page.id },
      data: { completedCount: { increment: 1 } },
    });
  }

  res.json({ tracked: true });
});

// ── Analytics (auth) ──────────────────────────────────────────────

exports.getSurpriseAnalytics = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const page = await prisma.surprisePage.findUnique({
    where: { id },
    select: {
      id: true, title: true, viewCount: true, completedCount: true,
      userId: true,
    },
  });
  if (!page) return res.status(404).json({ message: 'Not found' });
  if (page.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const interactions = await prisma.surpriseInteraction.findMany({
    where: { surprisePageId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const reactionCounts = await prisma.surpriseInteraction.groupBy({
    by: ['reaction'],
    where: { surprisePageId: id, reaction: { not: null } },
    _count: true,
  });

  res.json({
    viewCount: page.viewCount,
    completedCount: page.completedCount,
    completionRate: page.viewCount > 0
      ? Math.round((page.completedCount / page.viewCount) * 100)
      : 0,
    recentInteractions: interactions,
    reactionBreakdown: reactionCounts,
  });
});

// ── Publish / Deploy ──────────────────────────────────────────────

exports.publishSurprisePage = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const { deployTarget } = req.body; // 'auto' | 'netlify' | 'r2' | 'internal'

  const page = await prisma.surprisePage.findUnique({
    where: { id },
    include: { template: true },
  });
  if (!page) return res.status(404).json({ message: 'Not found' });
  if (page.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const requirement = await paymentService.requireCompletedPaymentForEntity({
    entityType: 'surprise_page',
    entityId: page.id,
    userId: page.userId,
  });

  if (requirement.required) {
    return res.status(402).json({
      message: 'Payment is required before publishing this surprise page',
      requiredPayment: true,
      entityType: 'surprise_page',
      entityId: page.id,
      config: requirement.config,
    });
  }

  const result = await deploySurprisePage(page, deployTarget || 'auto');

  const updated = await prisma.surprisePage.update({
    where: { id },
    data: {
      status: 'active',
      deployTarget: result.target,
      deployedUrl: result.siteUrl,
      deploySiteId: result.siteId,
      deployedAt: new Date(),
    },
    include: { template: true },
  });

  res.json({
    page: updated,
    deploy: {
      target: result.target,
      url: result.siteUrl,
    },
  });
});

// ── Unpublish ─────────────────────────────────────────────────────

exports.unpublishSurprisePage = asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id);
  const existing = await prisma.surprisePage.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  if (existing.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied' });
  }

  const page = await prisma.surprisePage.update({
    where: { id },
    data: { status: 'draft', deployedUrl: null, deployTarget: 'internal', deploySiteId: null },
    include: { template: true },
  });

  res.json({ page, message: 'Page unpublished' });
});

// ── Tracking Pixel (1×1 transparent gif) ──────────────────────────

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

exports.trackingPixel = asyncHandler(async (req, res) => {
  const { slug } = req.params;
  // Fire and forget — don't let failures break the pixel
  prisma.surprisePage.updateMany({
    where: { slug },
    data: { viewCount: { increment: 1 } },
  }).catch(() => {});

  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Content-Length': PIXEL_GIF.length,
  });
  res.end(PIXEL_GIF);
});
