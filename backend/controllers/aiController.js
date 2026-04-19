const asyncHandler = require('../utils/asyncHandler');
const { prisma } = require('../config/db');
const { chatJson, getProvider } = require('../services/groqAiService');
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
  <text x="90" y="180" font-family="Segoe UI, Arial" font-size="52" fill="#ffffff" font-weight="700">Vedika 360 AI Collage Preview</text>
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

// ─── AI Event Checklist Generator ─────────────────────────────────────────────
// POST /api/ai/generate-checklist
exports.generateChecklist = asyncHandler(async (req, res) => {
  const eventId = Number(req.body.eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true, title: true, type: true, date: true, venue: true, budget: true, guestCount: true, tasks: true },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (req.user.role !== 'admin' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const daysUntil = event.date ? Math.max(0, Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000)) : null;
  const systemPrompt = [
    'You are an expert Indian event planner. Generate a practical task checklist for the organizer.',
    'Each task should have: title, category (venue, catering, decoration, photography, invitations, attire, logistics, entertainment, misc), daysBeforeEvent (number), priority (high/medium/low), and a brief description.',
    'Tasks must be ordered by daysBeforeEvent (descending = earliest deadline first).',
    'Tailor tasks specifically to the event type. For weddings: include mehendi, sangeet, haldi, mandap, baraat logistics, etc. For corporate: include AV setup, speaker coordination, etc.',
    'Output JSON: {"tasks":[{"title":"string","category":"string","daysBeforeEvent":number,"priority":"high|medium|low","description":"string"}]}',
  ].join('\n');

  const userPrompt = JSON.stringify({
    eventType: event.type,
    eventTitle: event.title,
    eventDate: event.date,
    daysUntilEvent: daysUntil,
    venue: event.venue,
    estimatedBudget: event.budget,
    estimatedGuests: event.guestCount,
  });

  const ai = await chatJson(systemPrompt, userPrompt, { maxTokens: 2500 });

  let tasks;
  if (ai?.tasks && Array.isArray(ai.tasks)) {
    tasks = ai.tasks.map((t, i) => ({
      id: i + 1,
      title: String(t.title || '').trim(),
      category: String(t.category || 'misc').trim(),
      daysBeforeEvent: Number(t.daysBeforeEvent) || 0,
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      description: String(t.description || '').trim(),
      completed: false,
      source: 'ai',
    }));
  } else {
    // Fallback: deterministic checklist
    const base = [
      { title: 'Finalize venue booking', category: 'venue', daysBeforeEvent: 90, priority: 'high' },
      { title: 'Book catering vendor', category: 'catering', daysBeforeEvent: 75, priority: 'high' },
      { title: 'Book photographer/videographer', category: 'photography', daysBeforeEvent: 60, priority: 'high' },
      { title: 'Send invitations', category: 'invitations', daysBeforeEvent: 45, priority: 'high' },
      { title: 'Book decoration vendor', category: 'decoration', daysBeforeEvent: 45, priority: 'medium' },
      { title: 'Finalize menu with caterer', category: 'catering', daysBeforeEvent: 30, priority: 'medium' },
      { title: 'Arrange transportation/logistics', category: 'logistics', daysBeforeEvent: 21, priority: 'medium' },
      { title: 'Follow up on RSVPs', category: 'invitations', daysBeforeEvent: 14, priority: 'high' },
      { title: 'Confirm all vendor bookings', category: 'logistics', daysBeforeEvent: 7, priority: 'high' },
      { title: 'Final walkthrough at venue', category: 'venue', daysBeforeEvent: 3, priority: 'high' },
      { title: 'Prepare emergency kit', category: 'logistics', daysBeforeEvent: 1, priority: 'medium' },
    ];
    tasks = base.map((t, i) => ({ id: i + 1, ...t, description: '', completed: false, source: 'rules' }));
  }

  // Save to event tasks field
  await prisma.event.update({
    where: { id: eventId },
    data: { tasks },
  });

  res.json({
    eventId,
    source: ai ? getProvider() : 'rules',
    taskCount: tasks.length,
    tasks,
  });
});

// ─── Vendor Review Summarizer ─────────────────────────────────────────────────
// GET /api/ai/vendor/:vendorId/review-summary
exports.getVendorReviewSummary = asyncHandler(async (req, res) => {
  const vendorId = Number(req.params.vendorId);
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, businessName: true, category: true, averageRating: true, totalReviews: true },
  });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  const reviews = await prisma.review.findMany({
    where: { vendorId },
    select: { rating: true, comment: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  if (reviews.length < 2) {
    return res.json({
      vendorId,
      source: 'insufficient',
      summary: 'Not enough reviews to generate a summary. This vendor needs at least 2 reviews.',
      strengths: [],
      watchOuts: [],
      bestFor: '',
      reviewCount: reviews.length,
    });
  }

  const systemPrompt = [
    'You summarize vendor reviews for event organizers in India.',
    'Analyze the reviews and output a JSON object with:',
    '- summary: 2-3 sentence overview of this vendor',
    '- strengths: array of 2-4 short bullet strings (what clients consistently praise)',
    '- watchOuts: array of 0-3 short bullet strings (recurring concerns or areas to clarify)',
    '- bestFor: one sentence on what type of event/client this vendor suits best',
    'Be honest and balanced. If reviews are all positive, watchOuts can be empty.',
    'Output JSON only: {"summary":"string","strengths":["string"],"watchOuts":["string"],"bestFor":"string"}',
  ].join('\n');

  const reviewData = reviews.map((r) => ({ rating: r.rating, comment: r.comment }));
  const userPrompt = JSON.stringify({
    vendorName: vendor.businessName,
    category: vendor.category,
    averageRating: vendor.averageRating,
    reviews: reviewData,
  });

  const ai = await chatJson(systemPrompt, userPrompt, { maxTokens: 800 });

  if (ai) {
    return res.json({
      vendorId,
      source: getProvider(),
      summary: String(ai.summary || '').trim(),
      strengths: Array.isArray(ai.strengths) ? ai.strengths.map((s) => String(s).trim()) : [],
      watchOuts: Array.isArray(ai.watchOuts) ? ai.watchOuts.map((s) => String(s).trim()) : [],
      bestFor: String(ai.bestFor || '').trim(),
      reviewCount: reviews.length,
    });
  }

  // Fallback: basic stats
  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);
  const highCount = reviews.filter((r) => r.rating >= 4).length;
  return res.json({
    vendorId,
    source: 'rules',
    summary: `${vendor.businessName} has ${reviews.length} reviews with an average rating of ${avgRating}/5. ${highCount} reviews are 4+ stars.`,
    strengths: highCount > reviews.length / 2 ? ['Consistently high ratings from clients'] : [],
    watchOuts: [],
    bestFor: `${vendor.category} services`,
    reviewCount: reviews.length,
  });
});

// ─── Post-Event Insights ──────────────────────────────────────────────────────
// POST /api/ai/event/:eventId/post-event-insights
exports.getPostEventInsights = asyncHandler(async (req, res) => {
  const eventId = Number(req.params.eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, organizerId: true, title: true, type: true, date: true, venue: true, budget: true, guestCount: true, status: true },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (req.user.role !== 'admin' && event.organizerId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  // Gather real data from DB
  const [guests, bookings, budgetRecord, mediaCount, activities] = await Promise.all([
    prisma.guest.findMany({ where: { eventId }, select: { rsvpStatus: true, checkedIn: true, plusOnes: true } }),
    prisma.booking.findMany({ where: { eventId }, select: { status: true, price: true, vendor: { select: { businessName: true, category: true } } } }),
    prisma.budget.findFirst({ where: { eventId }, select: { totalBudget: true, allocations: true } }),
    prisma.media.count({ where: { eventId, isApproved: true } }),
    prisma.eventActivity.findMany({ where: { eventId }, select: { status: true, spendPlanned: true, spendActual: true, category: true } }),
  ]);

  const guestStats = {
    total: guests.length,
    accepted: guests.filter((g) => g.rsvpStatus === 'accepted').length,
    declined: guests.filter((g) => g.rsvpStatus === 'declined').length,
    pending: guests.filter((g) => g.rsvpStatus === 'pending').length,
    checkedIn: guests.filter((g) => g.checkedIn).length,
    totalPlusOnes: guests.reduce((s, g) => s + (g.plusOnes || 0), 0),
    attendanceRate: guests.length ? Math.round((guests.filter((g) => g.checkedIn).length / guests.length) * 100) : 0,
  };

  const bookingStats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    totalSpent: bookings.filter((b) => b.status !== 'cancelled').reduce((s, b) => s + (b.price || 0), 0),
    vendors: bookings.filter((b) => b.status !== 'cancelled').map((b) => ({
      name: b.vendor?.businessName,
      category: b.vendor?.category,
      price: b.price,
      status: b.status,
    })),
  };

  const budgetStats = {
    planned: budgetRecord?.totalBudget || event.budget || 0,
    actualFromBookings: bookingStats.totalSpent,
    actualFromActivities: activities.reduce((s, a) => s + (a.spendActual || 0), 0),
    variance: 0,
    variancePercent: 0,
  };
  const actualSpend = Math.max(budgetStats.actualFromBookings, budgetStats.actualFromActivities);
  budgetStats.variance = budgetStats.planned - actualSpend;
  budgetStats.variancePercent = budgetStats.planned ? Math.round(((budgetStats.planned - actualSpend) / budgetStats.planned) * 100) : 0;

  const activityStats = {
    total: activities.length,
    completed: activities.filter((a) => a.status === 'completed').length,
    inProgress: activities.filter((a) => a.status === 'in_progress').length,
    blocked: activities.filter((a) => a.status === 'blocked').length,
  };

  const factualData = { event: { title: event.title, type: event.type, date: event.date, venue: event.venue, status: event.status }, guestStats, bookingStats, budgetStats, activityStats, approvedPhotos: mediaCount };

  const systemPrompt = [
    'You are an event analytics assistant. Generate post-event insights from REAL data (provided).',
    'Do NOT make up numbers — use only the data provided. Be specific and actionable.',
    'Output JSON:',
    '{"overallSummary":"2-3 sentence event summary","attendanceInsight":"string about guest attendance and RSVP patterns","budgetInsight":"string about budget performance with actual numbers","vendorInsight":"string about vendor booking outcomes","keyWins":["string"],"improvements":["string"],"nextEventTips":["string"]}',
  ].join('\n');

  const ai = await chatJson(systemPrompt, JSON.stringify(factualData), { maxTokens: 1200 });

  if (ai) {
    return res.json({
      eventId,
      source: getProvider(),
      data: factualData,
      overallSummary: String(ai.overallSummary || '').trim(),
      attendanceInsight: String(ai.attendanceInsight || '').trim(),
      budgetInsight: String(ai.budgetInsight || '').trim(),
      vendorInsight: String(ai.vendorInsight || '').trim(),
      keyWins: Array.isArray(ai.keyWins) ? ai.keyWins.map((s) => String(s).trim()) : [],
      improvements: Array.isArray(ai.improvements) ? ai.improvements.map((s) => String(s).trim()) : [],
      nextEventTips: Array.isArray(ai.nextEventTips) ? ai.nextEventTips.map((s) => String(s).trim()) : [],
    });
  }

  // Fallback: structured stats without AI narrative
  return res.json({
    eventId,
    source: 'rules',
    data: factualData,
    overallSummary: `${event.title} had ${guestStats.checkedIn}/${guestStats.total} guests check in (${guestStats.attendanceRate}% attendance). ${bookingStats.confirmed + bookingStats.completed} vendors delivered services.`,
    attendanceInsight: `${guestStats.accepted} RSVPs accepted, ${guestStats.pending} still pending, ${guestStats.declined} declined. ${guestStats.checkedIn} actually checked in.`,
    budgetInsight: budgetStats.planned > 0
      ? `Budget was ${budgetStats.planned.toLocaleString()} with actual spend of ${actualSpend.toLocaleString()} (${budgetStats.variancePercent >= 0 ? 'under' : 'over'} budget by ${Math.abs(budgetStats.variancePercent)}%).`
      : 'No budget was set for this event.',
    vendorInsight: `${bookingStats.total} vendor bookings: ${bookingStats.confirmed} confirmed, ${bookingStats.completed} completed, ${bookingStats.cancelled} cancelled.`,
    keyWins: guestStats.attendanceRate > 70 ? ['Strong attendance rate above 70%'] : [],
    improvements: guestStats.pending > guestStats.total * 0.3 ? ['High number of pending RSVPs — consider earlier follow-ups next time'] : [],
    nextEventTips: ['Track actual vendor spend during the event for better budgeting next time'],
  });
});
