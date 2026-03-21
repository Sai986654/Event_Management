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
