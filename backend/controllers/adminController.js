const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

exports.verifyVendor = asyncHandler(async (req, res) => {
  const vendorId = Number(req.params.vendorId);
  const { status, notes } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'Invalid verification status' });
  }

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  const isApproved = status === 'approved';
  const updated = await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      verificationStatus: status,
      verificationNotes: notes || null,
      isVerified: isApproved,
      verifiedAt: isApproved ? new Date() : null,
      verifiedByAdminId: isApproved ? req.user.id : null,
    },
  });

  res.json({ vendor: updated });
});

exports.createUserByAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;
  if (!['organizer', 'vendor', 'customer', 'admin', 'guest'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return res.status(400).json({ message: 'Email already exists' });

  const hashed = await bcrypt.hash(password || 'password123', 12);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: hashed, role, phone },
  });

  if (role === 'vendor') {
    await prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: req.body.businessName || `${name}'s Services`,
        category: req.body.category || 'other',
        description: req.body.description || null,
      },
    });
  }

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
});

// ── Category Management ─────────────────────────────────────────────

exports.getCategories = asyncHandler(async (_req, res) => {
  const categories = await prisma.serviceCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  res.json({ categories });
});

exports.createCategory = asyncHandler(async (req, res) => {
  const { name, label, color, icon } = req.body;
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const existing = await prisma.serviceCategory.findUnique({ where: { name: slug } });
  if (existing) return res.status(400).json({ message: 'Category already exists' });

  const maxSort = await prisma.serviceCategory.aggregate({ _max: { sortOrder: true } });
  const category = await prisma.serviceCategory.create({
    data: { name: slug, label: label || name, color: color || 'default', icon: icon || null, sortOrder: (maxSort._max.sortOrder || 0) + 1 },
  });
  res.status(201).json({ category });
});

exports.deleteCategory = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const category = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!category) return res.status(404).json({ message: 'Category not found' });

  // Check if any vendors or packages use this category
  const vendorCount = await prisma.vendor.count({ where: { category: category.name } });
  const packageCount = await prisma.vendorPackage.count({ where: { category: category.name } });
  if (vendorCount > 0 || packageCount > 0) {
    return res.status(400).json({
      message: `Cannot delete: ${vendorCount} vendor(s) and ${packageCount} package(s) use this category. Reassign them first.`,
    });
  }

  await prisma.serviceCategory.delete({ where: { id } });
  res.json({ message: 'Category deleted' });
});

// ── Vendor Management ───────────────────────────────────────────────

exports.getAllVendors = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const skip = (page - 1) * limit;

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
    }),
    prisma.vendor.count(),
  ]);
  res.json({ vendors, total, page, limit });
});

exports.deleteVendor = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

  // Delete associated packages, testimonials, then the vendor
  await prisma.vendorTestimonial.deleteMany({ where: { vendorId: id } });
  await prisma.vendorPackage.deleteMany({ where: { vendorId: id } });
  await prisma.vendor.delete({ where: { id } });

  res.json({ message: 'Vendor removed from marketplace' });
});

// ── Google Form Vendor Sync ────────────────────────────────────────

/**
 * POST /api/admin/vendors/sync-google-forms
 * Manually trigger vendor sync from Google Forms
 * Admin only
 */
exports.syncVendorsFromGoogleForms = asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_FORM_SHEET_ID) {
    return res.status(400).json({
      message: 'Google Forms integration not configured. Set GOOGLE_FORM_SHEET_ID in environment variables.',
    });
  }

  try {
    const { syncVendorsFromGoogleForm } = require('../services/vendorFormSyncService');
    const { limit = 50 } = req.body;

    const results = await syncVendorsFromGoogleForm({ limit });

    res.json({
      message: 'Vendor sync completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminController] Sync error:', error.message);
    res.status(500).json({
      message: 'Sync failed',
      error: error.message,
    });
  }
});
