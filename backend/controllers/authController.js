const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

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
