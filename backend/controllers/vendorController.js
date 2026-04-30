const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { paginate } = require('../utils/pagination');
const { uploadFile } = require('../services/fileService');
const { geocode } = require('../services/locationService');
const paymentService = require('../services/paymentService');

const normalizeCategoryTags = (categories) => {
  if (Array.isArray(categories)) {
    return categories.map((c) => String(c).trim().toLowerCase()).filter(Boolean);
  }
  if (typeof categories === 'string') {
    return categories.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
  }
  return [];
};

const getVendorForUser = async (userId) => prisma.vendor.findUnique({ where: { userId } });

// POST /api/vendors
exports.createVendor = asyncHandler(async (req, res) => {
  const data = { ...req.body, userId: req.user.id };

  // Auto-geocode city/state to lat/lng
  if (data.city || data.state) {
    const coords = await geocode(data.city, data.state);
    if (coords) {
      data.latitude = coords.lat;
      data.longitude = coords.lng;
    }
  }

  const vendor = await prisma.vendor.create({ data });
  res.status(201).json({ vendor });
});

// Haversine distance in km between two lat/lng points
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET /api/vendors
exports.getVendors = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query.page, req.query.limit);
  const where = {};

  if (req.query.category) where.category = req.query.category.toLowerCase();
  if (req.query.city) where.city = { contains: req.query.city, mode: 'insensitive' };
  if (req.query.state) where.state = { contains: req.query.state, mode: 'insensitive' };
  if (req.query.minRating) where.averageRating = { gte: Number(req.query.minRating) };

  const userLat = req.query.lat ? Number(req.query.lat) : null;
  const userLng = req.query.lng ? Number(req.query.lng) : null;
  const radiusKm = req.query.radius ? Number(req.query.radius) : 50;

  // When geo params provided, fetch without pagination first to compute distance
  if (userLat != null && userLng != null) {
    const all = await prisma.vendor.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { averageRating: 'desc' },
    });

    // Compute distance for vendors with coordinates, keep others as null distance
    const withDistance = all.map((v) => {
      if (v.latitude != null && v.longitude != null) {
        const dist = haversineKm(userLat, userLng, v.latitude, v.longitude);
        return { ...v, distance: Math.round(dist * 10) / 10 };
      }
      return { ...v, distance: null };
    });

    // Vendors within radius (with coords) come first, sorted by distance
    // Vendors without coords go to the end
    const nearby = withDistance.filter((v) => v.distance !== null && v.distance <= radiusKm);
    const noCoords = withDistance.filter((v) => v.distance === null);
    nearby.sort((a, b) => a.distance - b.distance);

    const combined = [...nearby, ...noCoords];
    const total = combined.length;
    const paged = combined.slice(skip, skip + limit);

    return res.json({ vendors: paged, page, totalPages: Math.ceil(total / limit), total, nearby: nearby.length });
  }

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
      rawMaterialItems: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
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

  const data = { ...req.body };

  // Re-geocode if city or state changed
  const newCity = data.city !== undefined ? data.city : vendor.city;
  const newState = data.state !== undefined ? data.state : vendor.state;
  if (data.city !== undefined || data.state !== undefined) {
    if (newCity !== vendor.city || newState !== vendor.state) {
      const coords = await geocode(newCity, newState);
      if (coords) {
        data.latitude = coords.lat;
        data.longitude = coords.lng;
      }
    }
  }

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data,
  });
  res.json({ vendor: updated });
});

// POST /api/vendors/:id/media
exports.uploadVendorMedia = asyncHandler(async (req, res) => {
  const vendor = await prisma.vendor.findUnique({ where: { id: Number(req.params.id) } });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  if (vendor.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const requirement = await paymentService.requireCompletedPaymentForEntity({
    entityType: 'vendor_portfolio',
    entityId: vendor.id,
    userId: vendor.userId,
  });

  if (requirement.required) {
    return res.status(402).json({
      message: 'Payment is required before adding portfolio media',
      requiredPayment: true,
      entityType: 'vendor_portfolio',
      entityId: vendor.id,
      config: requirement.config,
    });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No media file uploaded' });
  }

  let uploaded = null;
  try {
    uploaded = await uploadFile(req.file.buffer, `vedika360/vendor-${vendor.id}`, { contentType: req.file.mimetype });
  } catch (err) {
    console.error('[VendorMedia] R2 upload failed:', err.message);
    return res.status(502).json({ message: 'File storage upload failed. Check R2 configuration.' });
  }

  const existingPortfolio = Array.isArray(vendor.portfolio) ? vendor.portfolio : [];
  const mediaItem = {
    id: `media-${Date.now()}`,
    url: uploaded.url,
    publicId: uploaded.publicId,
    type: req.file.mimetype.startsWith('video') ? 'video' : 'photo',
    caption: req.body.caption || '',
    createdAt: new Date().toISOString(),
  };

  const updated = await prisma.vendor.update({
    where: { id: vendor.id },
    data: { portfolio: [mediaItem, ...existingPortfolio].slice(0, 30) },
  });

  res.status(201).json({ media: mediaItem, portfolio: updated.portfolio });
});

// POST /api/vendors/raw-materials/photo
exports.uploadRawMaterialPhoto = asyncHandler(async (req, res) => {
  const vendor = await getVendorForUser(req.user.id);
  if (!vendor && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only vendors/admin can upload raw material photos' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No photo file uploaded' });
  }

  const ownerVendorId = vendor?.id || Number(req.body?.vendorId);
  if (!ownerVendorId) {
    return res.status(400).json({ message: 'vendorId is required for admin upload' });
  }

  let uploaded = null;
  try {
    uploaded = await uploadFile(req.file.buffer, `vedika360/vendor-${ownerVendorId}/raw-materials`, {
      contentType: req.file.mimetype,
    });
  } catch (err) {
    console.error('[RawMaterialPhoto] upload failed:', err.message);
    return res.status(502).json({ message: 'Photo upload failed. Check storage configuration.' });
  }

  res.status(201).json({ photoUrl: uploaded.url, publicId: uploaded.publicId });
});

// GET /api/vendors/raw-materials
exports.getRawMaterialItems = asyncHandler(async (req, res) => {
  const where = { isActive: true };

  if (req.query.vendorId) where.vendorId = Number(req.query.vendorId);
  if (req.query.q) {
    where.OR = [
      { itemName: { contains: req.query.q, mode: 'insensitive' } },
      { description: { contains: req.query.q, mode: 'insensitive' } },
    ];
  }

  const category = String(req.query.category || '').trim().toLowerCase();
  const items = await prisma.rawMaterialItem.findMany({
    where,
    include: {
      vendor: { select: { id: true, businessName: true, category: true, city: true, isVerified: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const filtered = category
    ? items.filter((i) => (Array.isArray(i.categories) ? i.categories : []).map((c) => String(c).toLowerCase()).includes(category))
    : items;

  res.json({ items: filtered });
});

// GET /api/vendors/raw-materials/mine
exports.getMyRawMaterialItems = asyncHandler(async (req, res) => {
  const vendor = await getVendorForUser(req.user.id);
  if (!vendor) return res.json({ items: [] });

  const items = await prisma.rawMaterialItem.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ items });
});

// POST /api/vendors/raw-materials
exports.createRawMaterialItem = asyncHandler(async (req, res) => {
  const vendor = await getVendorForUser(req.user.id);
  if (!vendor && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only vendors/admin can create raw material items' });
  }

  const vendorId = vendor?.id || Number(req.body.vendorId);
  if (!vendorId) return res.status(400).json({ message: 'vendorId is required' });

  const categories = normalizeCategoryTags(req.body.categories);
  const item = await prisma.rawMaterialItem.create({
    data: {
      vendorId,
      itemName: req.body.itemName,
      description: req.body.description || null,
      price: req.body.price || 0,
      photoUrl: req.body.photoUrl || null,
      categories,
      isActive: req.body.isActive ?? true,
    },
  });

  res.status(201).json({ item });
});

// PUT /api/vendors/raw-materials/:itemId
exports.updateRawMaterialItem = asyncHandler(async (req, res) => {
  const item = await prisma.rawMaterialItem.findUnique({ where: { id: Number(req.params.itemId) } });
  if (!item) return res.status(404).json({ message: 'Raw material item not found' });

  const myVendor = await getVendorForUser(req.user.id);
  if (req.user.role !== 'admin' && (!myVendor || myVendor.id !== item.vendorId)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const data = { ...req.body };
  if (data.categories !== undefined) {
    data.categories = normalizeCategoryTags(data.categories);
  }

  const updated = await prisma.rawMaterialItem.update({
    where: { id: item.id },
    data,
  });

  res.json({ item: updated });
});

// DELETE /api/vendors/raw-materials/:itemId
exports.deleteRawMaterialItem = asyncHandler(async (req, res) => {
  const item = await prisma.rawMaterialItem.findUnique({ where: { id: Number(req.params.itemId) } });
  if (!item) return res.status(404).json({ message: 'Raw material item not found' });

  const myVendor = await getVendorForUser(req.user.id);
  if (req.user.role !== 'admin' && (!myVendor || myVendor.id !== item.vendorId)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await prisma.rawMaterialItem.delete({ where: { id: item.id } });
  res.json({ message: 'Raw material item deleted' });
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
