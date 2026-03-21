const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');

// POST /api/vendors
exports.createVendor = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.create({
    data: { ...req.body, userId: req.user.id },
  });
  res.status(201).json({ vendor });
});

// GET /api/vendors
exports.getVendors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};

  if (req.query.category) where.category = req.query.category.toLowerCase();
  if (req.query.city) where.city = { contains: req.query.city, mode: 'insensitive' };
  if (req.query.minRating) where.averageRating = { gte: Number(req.query.minRating) };

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { averageRating: 'desc' },
      skip,
      take: limit,
    }),
    prisma.vendor.count({ where }),
  ]);

  res.json({ vendors, page, totalPages: Math.ceil(total / limit), total });
});

// GET /api/vendors/:id
exports.getVendor = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: Number(req.params.id) },
    include: {
      user: { select: { id: true, name: true, email: true } },
      packageCatalog: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
      testimonials: { orderBy: { createdAt: 'desc' }, take: 20 },
      reviews: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
  res.json({ vendor });
});

// PUT /api/vendors/:id
exports.updateVendor = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: Number(req.params.id) } });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  if (vendor.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: req.body,
  });
  res.json({ vendor: updated });
});

// DELETE /api/vendors/:id
exports.deleteVendor = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: Number(req.params.id) } });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  if (vendor.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await prisma.vendor.delete({ where: { id: vendor.id } });
  res.json({ message: 'Vendor deleted' });
});

// POST /api/vendors/:id/reviews
exports.addReview = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: Number(req.params.id) } });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  const existing = await prisma.review.findUnique({
    where: { vendorId_userId: { vendorId: vendor.id, userId: req.user.id } },
  });
  if (existing) {
    return res.status(400).json({ message: 'You already reviewed this vendor' });
  }

  const review = await prisma.review.create({
    data: {
      vendorId: vendor.id,
      userId: req.user.id,
      eventId: req.body.event || null,
      rating: req.body.rating,
      comment: req.body.comment,
    },
  });

  // Recalculate average rating
  const stats = await prisma.review.aggregate({
    where: { vendorId: vendor.id },
    _avg: { rating: true },
    _count: { id: true },
  });

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: {
      averageRating: Math.round((stats._avg.rating || 0) * 10) / 10,
      totalReviews: stats._count.id,
    },
  });

  res.status(201).json({ review });
});

// GET /api/vendors/:id/reviews
exports.getReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);

  const where = { vendorId: Number(req.params.id) };
  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.review.count({ where }),
  ]);

  res.json({ reviews, page, totalPages: Math.ceil(total / limit), total });
});
