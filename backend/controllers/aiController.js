const asyncHandler = require('../utils/asyncHandler');
const { prisma } = require('../config/db');
const {
  getSuggestions,
  buildPlannerCopilotPlan,
  optimizeBudgetScenario,
  autoRebalanceSelection,
  scoreVendorFit,
} = require('../services/aiService');
const {
  createJob,
  completeJob,
  failJob,
  getJob,
  collageEnabled,
  minPhotos,
  normalizeStyle,
} = require('../services/collageJobService');

const buildMockCollageDataUrl = ({ eventId, style, photoCount }) => {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f4b7f" />
      <stop offset="50%" stop-color="#1f7a8c" />
      <stop offset="100%" stop-color="#49a078" />
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#bg)"/>
  <rect x="60" y="60" width="1080" height="555" rx="22" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.34)"/>
  <text x="90" y="180" font-family="Segoe UI, Arial" font-size="52" fill="#ffffff" font-weight="700">EventOS AI Collage Preview</text>
  <text x="90" y="250" font-family="Segoe UI, Arial" font-size="32" fill="#d9f6ff">Event #${eventId}</text>
  <text x="90" y="300" font-family="Segoe UI, Arial" font-size="32" fill="#d9f6ff">Style: ${style}</text>
  <text x="90" y="350" font-family="Segoe UI, Arial" font-size="32" fill="#d9f6ff">Photos used: ${photoCount}</text>
  <text x="90" y="445" font-family="Segoe UI, Arial" font-size="24" fill="#f3fbff">This is a mock preview. Configure a real AI collage provider for production renders.</text>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// POST /api/ai/suggestions
exports.getAISuggestions = asyncHandler(async (req, res) => {
  const { eventType, budget, guestCount } = req.body;
  const suggestions = getSuggestions({ eventType, budget, guestCount });
  res.json({ suggestions });
});

// POST /api/ai/planner-copilot
exports.getPlannerCopilot = asyncHandler(async (req, res) => {
  const eventId = Number(req.body.eventId);
  if (!eventId) {
    return res.status(400).json({ message: 'Valid eventId is required' });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      title: true,
      type: true,
      date: true,
      venue: true,
      budget: true,
      guestCount: true,
    },
  });

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  if (req.user.role === 'customer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to access this event' });
  }

  const packages = await prisma.vendorPackage.findMany({
    where: { isActive: true },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          averageRating: true,
          isVerified: true,
          state: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const teluguStateSet = new Set(['telangana', 'andhra pradesh', 'ap', 'ts']);
  const plan = buildPlannerCopilotPlan({ event, packages, teluguStateSet });
  res.json({ plan });
});

// POST /api/ai/budget-optimizer
exports.getBudgetOptimizer = asyncHandler(async (req, res) => {
  const eventId = Number(req.body.eventId);
  if (!eventId) {
    return res.status(400).json({ message: 'Valid eventId is required' });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      budget: true,
      guestCount: true,
    },
  });

  if (!event) {
    return res.status(404).json({ message: 'Event not found' });
  }

  if (req.user.role === 'customer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to access this event' });
  }

  const packageIds = Array.isArray(req.body.packageIds)
    ? req.body.packageIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];

  if (!packageIds.length) {
    return res.status(400).json({ message: 'At least one valid packageId is required' });
  }

  const selectedPackages = await prisma.vendorPackage.findMany({
    where: { id: { in: packageIds }, isActive: true },
    include: {
      vendor: {
        select: {
          businessName: true,
        },
      },
    },
  });

  if (!selectedPackages.length) {
    return res.status(404).json({ message: 'No matching active packages found' });
  }

  const optimization = optimizeBudgetScenario({
    event,
    selectedPackages,
    scenarioGuestCount: req.body.guestCount,
    scenarioBudget: req.body.budget,
  });

  res.json({ optimization });
});

// POST /api/ai/auto-rebalance
exports.postAutoRebalance = asyncHandler(async (req, res) => {
  const eventId = Number(req.body.eventId);
  if (!eventId) {
    return res.status(400).json({ message: 'Valid eventId is required' });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      budget: true,
      guestCount: true,
    },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (req.user.role === 'customer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to access this event' });
  }

  const packageIds = Array.isArray(req.body.packageIds)
    ? req.body.packageIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
    : [];
  if (!packageIds.length) {
    return res.status(400).json({ message: 'At least one valid packageId is required' });
  }

  const selectedPackages = await prisma.vendorPackage.findMany({
    where: { id: { in: packageIds }, isActive: true },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          averageRating: true,
          isVerified: true,
        },
      },
    },
  });
  if (!selectedPackages.length) {
    return res.status(404).json({ message: 'No matching active packages found' });
  }

  const sectors = [...new Set(selectedPackages.map((pkg) => String(pkg.category || '').toLowerCase()))];
  const allPackages = await prisma.vendorPackage.findMany({
    where: { isActive: true, category: { in: sectors } },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          averageRating: true,
          isVerified: true,
        },
      },
    },
  });

  const rebalance = autoRebalanceSelection({
    event,
    selectedPackages,
    allPackages,
    scenarioGuestCount: req.body.guestCount,
    scenarioBudget: req.body.budget,
  });

  res.json({ rebalance });
});

// POST /api/ai/collage/event/:eventId
exports.createEventCollageJob = asyncHandler(async (req, res) => {
  if (!collageEnabled()) {
    return res.status(403).json({ message: 'AI collage is disabled by configuration' });
  }

  const eventId = Number(req.params.eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true, title: true },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (req.user.role === 'organizer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized for this event' });
  }

  const blessingPhotos = await prisma.media.findMany({
    where: {
      eventId,
      type: 'photo',
      uploadedBy: null,
      isFlagged: false,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  if (blessingPhotos.length < minPhotos) {
    return res.status(400).json({
      message: `Need at least ${minPhotos} remote blessing photos to generate collage`,
      available: blessingPhotos.length,
    });
  }

  const style = normalizeStyle(req.body.style);
  const job = createJob(eventId, style);
  try {
    const resultUrl = buildMockCollageDataUrl({ eventId, style, photoCount: blessingPhotos.length });
    const collageMedia = await prisma.media.create({
      data: {
        eventId,
        uploadedBy: null,
        guestName: 'AI Collage Bot',
        url: resultUrl,
        publicId: null,
        type: 'photo',
        caption: `AI ${style} collage generated from ${blessingPhotos.length} remote blessing photos`,
        isApproved: true,
        isFlagged: false,
      },
    });

    const done = completeJob(eventId, {
      resultUrl,
      mediaId: collageMedia.id,
      usedPhotos: blessingPhotos.length,
    });
    return res.status(201).json({ job: done });
  } catch (error) {
    const failed = failJob(eventId, error.message || 'Collage generation failed');
    return res.status(500).json({ job: failed, message: 'Collage generation failed' });
  }
});

// GET /api/ai/collage/event/:eventId/status
exports.getEventCollageJobStatus = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (req.user.role === 'organizer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized for this event' });
  }

  const current = getJob(eventId);
  if (current) return res.json({ job: current });

  const latestCollage = await prisma.media.findFirst({
    where: { eventId, guestName: 'AI Collage Bot', isFlagged: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!latestCollage) return res.json({ job: null });

  return res.json({
    job: {
      jobId: `historical_${eventId}_${latestCollage.id}`,
      eventId,
      status: 'completed',
      provider: 'historical',
      createdAt: latestCollage.createdAt,
      updatedAt: latestCollage.updatedAt,
      resultUrl: latestCollage.url,
      mediaId: latestCollage.id,
      usedPhotos: null,
      note: 'Latest previously generated collage',
    },
  });
});

// POST /api/ai/vendor-fit
exports.getVendorFit = asyncHandler(async (req, res) => {
  const eventId = Number(req.body.eventId);
  if (!eventId) {
    return res.status(400).json({ message: 'Valid eventId is required' });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      organizerId: true,
      venue: true,
      city: true,
      state: true,
      budget: true,
      customerPreferences: true,
      sectorCustomizations: true,
    },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });

  if (req.user.role === 'customer' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized to access this event' });
  }

  const category = String(req.body.category || '').trim().toLowerCase();
  const vendors = await prisma.vendor.findMany({
    where: category ? { category } : {},
    select: {
      id: true,
      businessName: true,
      category: true,
      city: true,
      state: true,
      averageRating: true,
      isVerified: true,
      basePrice: true,
    },
    take: 300,
  });

  const fit = scoreVendorFit({ event, vendors });

  const topRows = fit.slice(0, 25).map((row) => ({
    eventId: event.id,
    userId: req.user?.id || null,
    category: category || null,
    vendorId: row.vendorId,
    fitScore: row.fitScore,
    confidence: row.confidence,
    reasons: row.reasons,
  }));
  if (topRows.length) {
    await prisma.aiRecommendationSnapshot.createMany({ data: topRows });
  }

  res.json({ eventId, category: category || null, fit });
});
