const bcrypt = require('bcryptjs');
const path = require('path');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { validateManifest: validateAdobeExpressManifest } = require('../scripts/validate-adobe-express-manifest');
const { uploadFile } = require('../services/fileService');

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

// ── Invite Template Management ───────────────────────────────────────

const normalizeTemplateKey = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

exports.uploadAdobeExpressTemplateAsset = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const templateKey = normalizeTemplateKey(req.body?.templateKey || 'adobe-template');
  const uploadFolder = `vedika360/adobe-templates/${templateKey}/assets`;

  const uploaded = await uploadFile(req.file.buffer, uploadFolder, {
    contentType: req.file.mimetype,
    originalname: req.file.originalname,
  });

  const extension = path.extname(req.file.originalname || '').toLowerCase();
  const mimeType = String(req.file.mimetype || '').toLowerCase();
  const mediaType = mimeType.startsWith('video/')
    ? 'video'
    : mimeType.startsWith('audio/')
      ? 'audio'
      : 'image';

  return res.status(201).json({
    message: 'Asset uploaded successfully',
    asset: {
      name: req.file.originalname || uploaded.publicId.split('/').pop(),
      mimeType: req.file.mimetype,
      extension,
      size: req.file.size,
      mediaType,
      assetPath: uploaded.publicId,
      publicId: uploaded.publicId,
      url: uploaded.url,
    },
  });
});

const ADOBE_REQUIRED_WEDDING_FIELDS = ['brideName', 'groomName', 'eventDate', 'venueName', 'qrUrl'];

const normalizeAdobePalette = (manifest, variantKey) => {
  const variants = Array.isArray(manifest?.variantProfiles) ? manifest.variantProfiles : [];
  const preferred = variants.find((item) => item?.key === variantKey) || variants[0] || {};
  const palette = preferred.palette || {};

  const primary = String(palette.primary || '#7c2d12');
  const secondary = String(palette.secondary || '#fff7f2');
  const accent = String(palette.accent || '#b45309');
  const text = String(palette.text || '#1f2937');

  return {
    background: secondary,
    frame: primary,
    innerBorder: accent,
    header: primary,
    headerText: secondary,
    accent,
    title: primary,
    subtitle: accent,
    body: text,
    subtle: '#6b7280',
    divider: accent,
    link: accent,
    badge: secondary,
    badgeText: primary,
    __templateEngine: 'adobe-express',
    __adobeExpress: {
      manifestVersion: manifest.manifestVersion,
      templateName: manifest.templateName,
      source: manifest.source || null,
      editableFields: manifest.editableFields || [],
      variantProfiles: variants,
      outputProfiles: manifest.outputProfiles || [],
      timeline: manifest.timeline || [],
      assets: manifest.assets || {},
      importedAt: new Date().toISOString(),
    },
  };
};

const buildAdobeManifestWarnings = (manifest) => {
  const warnings = [];

  if (manifest?.category === 'wedding') {
    const fieldIds = new Set((manifest.editableFields || []).map((field) => field?.id));
    const missing = ADOBE_REQUIRED_WEDDING_FIELDS.filter((fieldId) => !fieldIds.has(fieldId));
    if (missing.length) {
      warnings.push(`Wedding template is missing recommended fields: ${missing.join(', ')}`);
    }
  }

  if (!Array.isArray(manifest?.variantProfiles) || manifest.variantProfiles.length < 2) {
    warnings.push('Template has fewer than 2 variants. Consider adding more style variants for better personalization.');
  }

  return warnings;
};

exports.validateAdobeExpressTemplateManifest = asyncHandler(async (req, res) => {
  const manifest = req.body?.manifest && typeof req.body.manifest === 'object' ? req.body.manifest : req.body;
  const errors = validateAdobeExpressManifest(manifest);
  const warnings = errors.length ? [] : buildAdobeManifestWarnings(manifest);

  return res.status(errors.length ? 400 : 200).json({
    valid: errors.length === 0,
    errors,
    warnings,
  });
});

exports.importAdobeExpressTemplateManifest = asyncHandler(async (req, res) => {
  const manifest = req.body?.manifest && typeof req.body.manifest === 'object' ? req.body.manifest : req.body;
  const errors = validateAdobeExpressManifest(manifest);
  if (errors.length) {
    return res.status(400).json({
      message: 'Invalid Adobe Express manifest',
      valid: false,
      errors,
    });
  }

  const upsert = req.body?.upsert !== undefined ? Boolean(req.body.upsert) : true;
  const variantKey = req.body?.variantKey ? String(req.body.variantKey).trim() : '';
  const key = normalizeTemplateKey(manifest.templateKey || manifest.templateName);

  if (!key) {
    return res.status(400).json({ message: 'templateKey is required in manifest' });
  }

  const data = {
    key,
    name: String(manifest.templateName || key).trim(),
    description: String(manifest.description || `Imported from Adobe Express (v${manifest.version || 1})`).trim(),
    palette: normalizeAdobePalette(manifest, variantKey),
    isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
  };

  const existing = await prisma.inviteTemplate.findUnique({ where: { key } });
  let template;

  if (existing) {
    if (!upsert) {
      return res.status(409).json({
        message: 'Template key already exists. Set upsert=true to update it.',
        template: existing,
      });
    }

    template = await prisma.inviteTemplate.update({
      where: { id: existing.id },
      data,
    });
  } else {
    const maxSort = await prisma.inviteTemplate.aggregate({ _max: { sortOrder: true } });
    template = await prisma.inviteTemplate.create({
      data: {
        ...data,
        sortOrder: req.body?.sortOrder !== undefined ? Number(req.body.sortOrder) : (maxSort._max.sortOrder || 0) + 1,
      },
    });
  }

  const warnings = buildAdobeManifestWarnings(manifest);

  return res.status(existing ? 200 : 201).json({
    message: existing ? 'Adobe Express template updated successfully' : 'Adobe Express template imported successfully',
    template,
    warnings,
  });
});

exports.getInviteTemplates = asyncHandler(async (_req, res) => {
  const templates = await prisma.inviteTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  res.json({ templates });
});

exports.createInviteTemplate = asyncHandler(async (req, res) => {
  const key = normalizeTemplateKey(req.body.key || req.body.name);
  if (!key) return res.status(400).json({ message: 'Template key is required' });

  const existing = await prisma.inviteTemplate.findUnique({ where: { key } });
  if (existing) return res.status(400).json({ message: 'Template key already exists' });

  const maxSort = await prisma.inviteTemplate.aggregate({ _max: { sortOrder: true } });
  const template = await prisma.inviteTemplate.create({
    data: {
      key,
      name: String(req.body.name || key).trim(),
      description: req.body.description ? String(req.body.description).trim() : null,
      palette: req.body.palette && typeof req.body.palette === 'object' ? req.body.palette : {},
      isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
      sortOrder:
        req.body.sortOrder !== undefined
          ? Number(req.body.sortOrder)
          : (maxSort._max.sortOrder || 0) + 1,
    },
  });

  res.status(201).json({ template });
});

exports.updateInviteTemplate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.inviteTemplate.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Invite template not found' });

  const nextKey = req.body.key ? normalizeTemplateKey(req.body.key) : undefined;
  if (nextKey && nextKey !== existing.key) {
    const collision = await prisma.inviteTemplate.findUnique({ where: { key: nextKey } });
    if (collision) return res.status(400).json({ message: 'Template key already exists' });
  }

  const updateData = {};
  if (nextKey) updateData.key = nextKey;
  if (req.body.name !== undefined) updateData.name = String(req.body.name).trim();
  if (req.body.description !== undefined) {
    updateData.description = req.body.description ? String(req.body.description).trim() : null;
  }
  if (req.body.palette !== undefined) {
    updateData.palette = req.body.palette && typeof req.body.palette === 'object' ? req.body.palette : {};
  }
  if (req.body.isActive !== undefined) updateData.isActive = Boolean(req.body.isActive);
  if (req.body.sortOrder !== undefined) updateData.sortOrder = Number(req.body.sortOrder);

  const template = await prisma.inviteTemplate.update({
    where: { id },
    data: updateData,
  });

  res.json({ template });
});

exports.deleteInviteTemplate = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const template = await prisma.inviteTemplate.findUnique({ where: { id } });
  if (!template) return res.status(404).json({ message: 'Invite template not found' });

  await prisma.inviteTemplate.delete({ where: { id } });
  res.json({ message: 'Invite template deleted' });
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
  if (!process.env.GOOGLE_FORM_SHEET_ID && !req.body?.spreadsheetId) {
    return res.status(400).json({
      message: 'Google Forms integration not configured. Set GOOGLE_FORM_SHEET_ID or pass spreadsheetId in request body.',
    });
  }

  try {
    const { syncVendorsFromGoogleForm } = require('../services/vendorFormSyncService');
    const {
      limit = 50,
      spreadsheetId,
      range,
      defaultPassword,
      includeCredentialsInResponse = false,
    } = req.body;

    const results = await syncVendorsFromGoogleForm({
      limit,
      ...(spreadsheetId ? { spreadsheetId } : {}),
      ...(range ? { range } : {}),
      ...(defaultPassword ? { defaultPassword } : {}),
      includeCredentials: includeCredentialsInResponse,
    });

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

/**
 * POST /api/admin/vendors/sync-google-places
 * Discover businesses from Google Places and onboard them as vendors.
 */
exports.syncVendorsFromGooglePlaces = asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return res.status(400).json({
      message: 'Google Places integration not configured. Set GOOGLE_MAPS_API_KEY in environment variables.',
    });
  }

  try {
    const { syncVendorsFromGooglePlaces } = require('../services/vendorPlacesSyncService');
    const {
      query,
      city,
      state,
      lat,
      lng,
      radiusMeters = 15000,
      type,
      limit = 100,
      reviewPage = 1,
      reviewLimit = 20,
      defaultPassword,
      includeCredentialsInResponse = false,
      forceCategory,
    } = req.body;

    const results = await syncVendorsFromGooglePlaces({
      query,
      city,
      state,
      lat,
      lng,
      radiusMeters,
      type,
      limit,
      reviewPage,
      reviewLimit,
      ...(defaultPassword ? { defaultPassword } : {}),
      includeCredentials: includeCredentialsInResponse,
      forceCategory,
    });

    res.json({
      message: 'Google Places vendor sync completed',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AdminController] Google Places sync error:', error.message);
    res.status(500).json({
      message: 'Google Places sync failed',
      error: error.message,
    });
  }
});
