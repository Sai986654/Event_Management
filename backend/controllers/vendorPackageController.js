const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const getVendorIdForUser = async (userId) => {
  return prisma.vendor.findUnique({ where: { userId } });
};

exports.createPackage = asyncHandler(async (req, res) => {
  const vendor = await getVendorIdForUser(req.user.id);
  if (!vendor) return res.status(400).json({ message: 'Create vendor profile first' });

  const created = await prisma.vendorPackage.create({
    data: {
      vendorId: vendor.id,
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      tier: req.body.tier || 'standard',
      basePrice: req.body.basePrice || 0,
      currency: req.body.currency || 'INR',
      unitLabel: req.body.unitLabel || null,
      estimationRules: req.body.estimationRules || {},
      deliverables: req.body.deliverables || [],
      isActive: req.body.isActive ?? true,
    },
  });

  res.status(201).json({ package: created });
});

exports.getMyPackages = asyncHandler(async (req, res) => {
  const vendor = await getVendorIdForUser(req.user.id);
  if (!vendor) return res.json({ packages: [] });

  const packages = await prisma.vendorPackage.findMany({
    where: { vendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ packages });
});

exports.getPublicPackages = asyncHandler(async (req, res) => {
  const where = { isActive: true, vendor: { isVerified: true } };
  if (req.query.category) where.category = req.query.category;
  if (req.query.vendorId) where.vendorId = Number(req.query.vendorId);

  const packages = await prisma.vendorPackage.findMany({
    where,
    include: {
      vendor: {
        select: { id: true, businessName: true, category: true, averageRating: true, isVerified: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ packages });
});

exports.updatePackage = asyncHandler(async (req, res) => {
  const pkg = await prisma.vendorPackage.findUnique({ where: { id: Number(req.params.id) } });
  if (!pkg) return res.status(404).json({ message: 'Package not found' });

  const vendor = await getVendorIdForUser(req.user.id);
  if (req.user.role !== 'admin' && (!vendor || pkg.vendorId !== vendor.id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  const updated = await prisma.vendorPackage.update({
    where: { id: pkg.id },
    data: { ...req.body },
  });

  res.json({ package: updated });
});

exports.deletePackage = asyncHandler(async (req, res) => {
  const pkg = await prisma.vendorPackage.findUnique({ where: { id: Number(req.params.id) } });
  if (!pkg) return res.status(404).json({ message: 'Package not found' });

  const vendor = await getVendorIdForUser(req.user.id);
  if (req.user.role !== 'admin' && (!vendor || pkg.vendorId !== vendor.id)) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await prisma.vendorPackage.delete({ where: { id: pkg.id } });
  res.json({ message: 'Package deleted' });
});

exports.addTestimonial = asyncHandler(async (req, res) => {
  const vendor = await getVendorIdForUser(req.user.id);
  if (!vendor) return res.status(400).json({ message: 'Create vendor profile first' });

  const testimonial = await prisma.vendorTestimonial.create({
    data: {
      vendorId: vendor.id,
      clientName: req.body.clientName,
      content: req.body.content,
      rating: req.body.rating || 5,
      source: req.body.source || null,
    },
  });
  res.status(201).json({ testimonial });
});

exports.getVendorTestimonials = asyncHandler(async (req, res) => {
  const testimonials = await prisma.vendorTestimonial.findMany({
    where: { vendorId: Number(req.params.vendorId) },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ testimonials });
});
