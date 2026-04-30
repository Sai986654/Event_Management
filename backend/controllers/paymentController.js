const { prisma } = require('../config/db');
const paymentService = require('../services/paymentService');
const asyncHandler = require('../utils/asyncHandler');

// ── Payment Creation ────────────────────────────────────────

exports.initiatePayment = asyncHandler(async (req, res) => {
  const { entityType, entityId, amount, description } = req.body;
  const userId = req.user.id;

  if (!paymentService.PAYMENT_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ message: 'Invalid entity type' });
  }

  if (!Number.isInteger(Number(entityId)) || Number(entityId) <= 0) {
    return res.status(400).json({ message: 'entityId must be a positive integer' });
  }

  // Check if payment is required for this entity type
  const isRequired = await paymentService.isPaymentRequired(entityType);
  const config = await paymentService.getPaymentConfiguration(entityType);

  if (!isRequired && !config.allowManualOverride) {
    return res.status(400).json({ message: 'Payment is not enabled for this service' });
  }

  const amountFromConfig = Number(config?.amount || 0);
  const amountFromRequest = Number(amount || 0);
  const finalAmount = amountFromConfig > 0 ? amountFromConfig : amountFromRequest;

  if (!finalAmount || finalAmount <= 0) {
    return res.status(400).json({ message: 'Amount must be greater than 0' });
  }

  // Verify entity exists
  const validEntity = await verifyEntity(entityType, entityId, userId);
  if (!validEntity) {
    return res.status(404).json({ message: `${entityType} not found` });
  }

  try {
    const orderData = await paymentService.createRazorpayOrder(
      finalAmount,
      entityType,
      entityId,
      userId,
      description
    );

    res.status(201).json(orderData);
  } catch (error) {
    console.error('Error initiating payment:', error);
    res.status(500).json({ message: 'Failed to initiate payment' });
  }
});

// GET /api/payments/requirements/:entityType/:entityId
exports.getPaymentRequirement = asyncHandler(async (req, res) => {
  const entityType = String(req.params.entityType || '').trim();
  const entityId = Number(req.params.entityId);

  if (!paymentService.PAYMENT_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ message: 'Invalid entity type' });
  }
  if (!Number.isInteger(entityId) || entityId <= 0) {
    return res.status(400).json({ message: 'entityId must be a positive integer' });
  }

  const validEntity = await verifyEntity(entityType, entityId, req.user.id);
  if (!validEntity) {
    return res.status(404).json({ message: `${entityType} not found` });
  }

  const requirement = await paymentService.requireCompletedPaymentForEntity({
    entityType,
    entityId,
    userId: req.user.id,
  });

  res.json({
    entityType,
    entityId,
    required: requirement.required,
    config: requirement.config,
    payment: requirement.payment,
  });
});

// ── Payment Verification ────────────────────────────────────

exports.verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
  const userId = req.user.id;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Missing payment details' });
  }

  // Verify signature
  const isValid = paymentService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }

  try {
    // Get payment from DB
    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId },
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    if (payment.userId !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update payment status
    const updatedPayment = await paymentService.updatePaymentAfterVerification(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    // Update entity based on type
    await updateEntityAfterPayment(payment.entityType, payment.entityId);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      payment: updatedPayment,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
});

// ── Get Payment Details ─────────────────────────────────────

exports.getPaymentDetails = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const userId = req.user.id;

  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(paymentId) },
  });

  if (!payment) {
    return res.status(404).json({ message: 'Payment not found' });
  }

  if (payment.userId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  res.json({ payment });
});

// ── Get User Payments ───────────────────────────────────────

exports.getUserPayments = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { status, entityType, limit = 50, offset = 0 } = req.query;

  const where = { userId };
  if (status) where.status = status;
  if (entityType) where.entityType = entityType;

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit),
    skip: parseInt(offset),
  });

  const total = await prisma.payment.count({ where });

  res.json({ payments, total, limit: parseInt(limit), offset: parseInt(offset) });
});

// ── Refund Payment ──────────────────────────────────────────

exports.refundPayment = asyncHandler(async (req, res) => {
  const { paymentId } = req.params;
  const { amount } = req.body;
  const userId = req.user.id;

  const payment = await prisma.payment.findUnique({
    where: { id: parseInt(paymentId) },
  });

  if (!payment) {
    return res.status(404).json({ message: 'Payment not found' });
  }

  if (payment.userId !== userId && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  if (payment.status !== 'completed') {
    return res.status(400).json({ message: 'Only completed payments can be refunded' });
  }

  if (!payment.razorpayPaymentId) {
    return res.status(400).json({ message: 'Payment has no Razorpay payment ID' });
  }

  try {
    const refund = await paymentService.refundPayment(payment.razorpayPaymentId, amount || payment.amount);

    res.json({
      success: true,
      message: 'Refund initiated successfully',
      refund,
    });
  } catch (error) {
    console.error('Error refunding payment:', error);
    res.status(500).json({ message: 'Failed to process refund' });
  }
});

// ── Webhook Handler ────────────────────────────────────────

exports.handleWebhook = asyncHandler(async (req, res) => {
  const { id, event, payload } = req.body;

  // Log webhook
  await paymentService.logWebhookEvent(id, event, payload);

  try {
    // Process webhook
    await paymentService.processWebhookEvent({ event, payload });
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ success: false, message: 'Failed to process webhook' });
  }
});

// ── Admin Payment Config ───────────────────────────────────

exports.getPaymentConfigurations = asyncHandler(async (_req, res) => {
  const configs = await paymentService.getPaymentConfigurations();
  res.json({ configs });
});

exports.upsertPaymentConfiguration = asyncHandler(async (req, res) => {
  const entityType = String(req.params.entityType || '').trim();
  if (!paymentService.PAYMENT_ENTITY_TYPES.includes(entityType)) {
    return res.status(400).json({ message: 'Invalid entity type' });
  }

  const data = {
    isEnabled: req.body.isEnabled !== undefined ? Boolean(req.body.isEnabled) : undefined,
    amount:
      req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== ''
        ? Number(req.body.amount)
        : null,
    description:
      req.body.description !== undefined
        ? (req.body.description ? String(req.body.description).trim() : null)
        : undefined,
    allowManualOverride:
      req.body.allowManualOverride !== undefined ? Boolean(req.body.allowManualOverride) : undefined,
    notes:
      req.body.notes !== undefined
        ? (req.body.notes && typeof req.body.notes === 'object' ? req.body.notes : {})
        : undefined,
  };

  Object.keys(data).forEach((key) => {
    if (data[key] === undefined) delete data[key];
  });

  if (Object.prototype.hasOwnProperty.call(data, 'amount') && data.amount !== null && data.amount < 0) {
    return res.status(400).json({ message: 'amount must be >= 0' });
  }

  const config = await prisma.paymentConfiguration.upsert({
    where: { entityType },
    update: data,
    create: {
      entityType,
      isEnabled: Boolean(data.isEnabled),
      amount: data.amount,
      description: data.description || null,
      allowManualOverride: data.allowManualOverride !== undefined ? data.allowManualOverride : true,
      notes: data.notes || {},
    },
  });

  res.json({ config });
});

// ── Helper Functions ────────────────────────────────────────

async function verifyEntity(entityType, entityId, userId) {
  switch (entityType) {
    case 'event':
      return await prisma.event.findFirst({
        where: { id: parseInt(entityId), organizerId: userId },
      });
    case 'booking':
      return await prisma.booking.findFirst({
        where: { id: parseInt(entityId), organizerId: userId },
      });
    case 'order':
      return await prisma.eventOrder.findFirst({
        where: { id: parseInt(entityId), organizerId: userId },
      });
    case 'surprise_page':
      return await prisma.surprisePage.findFirst({
        where: { id: parseInt(entityId), userId },
      });
    case 'invite_design_export':
      return await prisma.inviteDesign.findFirst({
        where: {
          id: parseInt(entityId),
          event: { organizerId: userId },
        },
      });
    case 'vendor_portfolio':
      return await prisma.vendor.findFirst({
        where: {
          id: parseInt(entityId),
          userId,
        },
      });
    default:
      return true;
  }
}

async function updateEntityAfterPayment(entityType, entityId) {
  switch (entityType) {
    case 'event':
      return await prisma.event.update({
        where: { id: parseInt(entityId) },
        data: { status: 'planning' },
      });
    case 'booking':
      return await prisma.booking.update({
        where: { id: parseInt(entityId) },
        data: { status: 'confirmed' },
      });
    case 'order':
      return await prisma.eventOrder.update({
        where: { id: parseInt(entityId) },
        data: { status: 'placed' },
      });
    case 'surprise_page':
      return await prisma.surprisePage.update({
        where: { id: parseInt(entityId) },
        data: { isPaid: true },
      });
    default:
      return null;
  }
}

module.exports = exports;
