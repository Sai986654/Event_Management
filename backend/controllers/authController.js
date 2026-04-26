const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { uploadFile } = require('../services/fileService');

const generateToken = (user) => {
  const jwtSecret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? null : 'dev-test-jwt-secret');
  const jwtExpire = process.env.JWT_EXPIRE || '7d';

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required in production');
  }

  return jwt.sign({ id: user.id, role: user.role }, jwtSecret, {
    expiresIn: jwtExpire,
  });
};

// POST /api/auth/register
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone } = req.body;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return res.status(400).json({ message: 'Email already registered' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: hashedPassword, role, phone },
  });

  const token = generateToken(user);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// POST /api/auth/login
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

// GET /api/auth/me
exports.getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile
exports.updateProfile = asyncHandler(async (req, res) => {
  const updates = {};
  const allowed = ['name', 'phone', 'avatar'];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: updates,
  });

  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

// POST /api/auth/profile/avatar
exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image uploaded' });
  }

  if (!String(req.file.mimetype || '').startsWith('image/')) {
    return res.status(400).json({ message: 'Only image files are allowed for profile picture' });
  }

  const uploaded = await uploadFile(req.file.buffer, `vedika360/user-${req.user.id}/avatar`, {
    contentType: req.file.mimetype,
    originalname: req.file.originalname,
  });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { avatar: uploaded.url },
  });

  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, avatarUrl: uploaded.url });
});

// PUT /api/auth/password
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { password: hashedPassword },
  });

  res.json({ message: 'Password updated successfully' });
});

const buildDeleteBlockers = async (userId, vendorId) => {
  const [events, organizerBookings, customerOrders, organizerOrders, vendorBookings, vendorOrderItems, vendorReviews, vendorActivities] = await Promise.all([
    prisma.event.count({ where: { organizerId: userId } }),
    prisma.booking.count({ where: { organizerId: userId } }),
    prisma.eventOrder.count({ where: { customerId: userId } }),
    prisma.eventOrder.count({ where: { organizerId: userId } }),
    vendorId ? prisma.booking.count({ where: { vendorId } }) : 0,
    vendorId ? prisma.eventOrderItem.count({ where: { vendorId } }) : 0,
    vendorId ? prisma.review.count({ where: { vendorId } }) : 0,
    vendorId ? prisma.eventActivity.count({ where: { vendorId } }) : 0,
  ]);

  const blockers = [];
  if (events > 0) blockers.push(`You still own ${events} event(s)`);
  if (organizerBookings > 0) blockers.push(`You still manage ${organizerBookings} booking(s)`);
  if (customerOrders > 0) blockers.push(`You still have ${customerOrders} customer order(s)`);
  if (organizerOrders > 0) blockers.push(`You still manage ${organizerOrders} organizer order(s)`);
  if (vendorBookings > 0) blockers.push(`Your vendor profile has ${vendorBookings} booking(s)`);
  if (vendorOrderItems > 0) blockers.push(`Your vendor profile is used in ${vendorOrderItems} order item(s)`);
  if (vendorReviews > 0) blockers.push(`Your vendor profile has ${vendorReviews} review(s)`);
  if (vendorActivities > 0) blockers.push(`Your vendor profile has ${vendorActivities} activity record(s)`);
  return blockers;
};

// DELETE /api/auth/account
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { currentPassword } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { vendorProfile: true },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (user.role === 'admin') {
    return res.status(403).json({ message: 'Admin accounts cannot be deleted from profile settings' });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Current password is incorrect' });
  }

  const vendorId = user.vendorProfile?.id || null;
  const blockers = await buildDeleteBlockers(user.id, vendorId);
  if (blockers.length > 0) {
    return res.status(400).json({
      message: 'Account cannot be deleted yet',
      errors: blockers.map((msg) => ({ message: msg })),
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiRecommendationSnapshot.updateMany({ where: { userId: user.id }, data: { userId: null } });
    await tx.eventActivity.updateMany({ where: { updatedById: user.id }, data: { updatedById: null } });
    await tx.media.updateMany({ where: { uploadedBy: user.id }, data: { uploadedBy: null } });
    await tx.instantPhoto.updateMany({ where: { uploadedBy: user.id }, data: { uploadedBy: null } });
    await tx.review.deleteMany({ where: { userId: user.id } });
    await tx.chatMessage.deleteMany({ where: { senderId: user.id } });
    await tx.chatParticipant.deleteMany({ where: { userId: user.id } });
    await tx.chatThread.deleteMany({ where: { creatorId: user.id } });
    await tx.surprisePage.deleteMany({ where: { userId: user.id } });

    if (vendorId) {
      await tx.rawMaterialItem.deleteMany({ where: { vendorId } });
      await tx.vendorTestimonial.deleteMany({ where: { vendorId } });
      await tx.vendorPackage.deleteMany({ where: { vendorId } });
      await tx.vendor.delete({ where: { id: vendorId } });
    }

    await tx.user.delete({ where: { id: user.id } });
  });

  res.json({ message: 'Account deleted successfully' });
});
