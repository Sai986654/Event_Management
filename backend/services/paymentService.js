const razorpayInstance = require('../config/razorpay');
const { prisma } = require('../config/db');
const crypto = require('crypto');

const PAYMENT_ENTITY_TYPES = [
  'event',
  'booking',
  'order',
  'surprise_page',
  'invite_design_export',
  'vendor_portfolio',
];

// Create Razorpay order
exports.createRazorpayOrder = async (amount, entityType, entityId, userId, description = '') => {
  try {
    const order = await razorpayInstance.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `${entityType}_${entityId}_${Date.now()}`,
      notes: {
        entityType,
        entityId,
        userId,
      },
    });

    // Save payment record
    const payment = await prisma.payment.create({
      data: {
        razorpayOrderId: order.id,
        userId,
        entityType,
        entityId,
        amount: parseFloat(amount),
        status: 'initiated',
        description,
      },
    });

    return {
      success: true,
      orderId: order.id,
      amount: amount,
      paymentId: payment.id,
      keyId: process.env.RAZORPAY_KEY_ID,
    };
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw new Error('Failed to create payment order');
  }
};

// Verify payment signature
exports.verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Error verifying payment signature:', error);
    return false;
  }
};

// Update payment after verification
exports.updatePaymentAfterVerification = async (razorpayOrderId, razorpayPaymentId, signature) => {
  try {
    const payment = await prisma.payment.update({
      where: { razorpayOrderId },
      data: {
        razorpayPaymentId,
        razorpaySignature: signature,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    return payment;
  } catch (error) {
    console.error('Error updating payment:', error);
    throw new Error('Failed to update payment');
  }
};

// Fetch payment details from Razorpay
exports.fetchPaymentDetails = async (paymentId) => {
  try {
    const payment = await razorpayInstance.payments.fetch(paymentId);
    return payment;
  } catch (error) {
    console.error('Error fetching payment details:', error);
    throw new Error('Failed to fetch payment details');
  }
};

// Refund payment
exports.refundPayment = async (razorpayPaymentId, amount = null) => {
  try {
    const refundData = {};
    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to paise
    }

    const refund = await razorpayInstance.payments.refund(razorpayPaymentId, refundData);

    // Update payment record
    const payment = await prisma.payment.findUnique({
      where: { razorpayPaymentId },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          razorpayRefundId: refund.id,
          status: 'refunded',
          refundedAt: new Date(),
        },
      });
    }

    return refund;
  } catch (error) {
    console.error('Error refunding payment:', error);
    throw new Error('Failed to refund payment');
  }
};

// Get payment configuration for entity
exports.getPaymentConfiguration = async (entityType) => {
  try {
    const config = await prisma.paymentConfiguration.findUnique({
      where: { entityType },
    });

    return config || { isEnabled: false, amount: 0 };
  } catch (error) {
    console.error('Error fetching payment configuration:', error);
    return { isEnabled: false, amount: 0 };
  }
};

// Check if payment is required for entity
exports.isPaymentRequired = async (entityType) => {
  const config = await exports.getPaymentConfiguration(entityType);
  return config.isEnabled;
};

// Log webhook event
exports.logWebhookEvent = async (webhookId, eventType, payload) => {
  try {
    await prisma.paymentWebhookLog.create({
      data: {
        webhookId,
        eventType,
        payload,
      },
    });
  } catch (error) {
    console.error('Error logging webhook:', error);
  }
};

// Process webhook
exports.processWebhookEvent = async (webhookData) => {
  try {
    const { event, payload } = webhookData;

    if (event === 'payment.authorized') {
      // Handle payment authorized
      const { razorpay_payment_id, razorpay_order_id } = payload.payment.entity;

      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            razorpayPaymentId: razorpay_payment_id,
            status: 'completed',
            completedAt: new Date(),
          },
        });
      }

      return { success: true, message: 'Payment authorized' };
    }

    if (event === 'payment.failed') {
      // Handle payment failed
      const { razorpay_order_id, error } = payload.payment.entity;

      const payment = await prisma.payment.findUnique({
        where: { razorpayOrderId: razorpay_order_id },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'failed',
            failureReason: error?.description || 'Payment failed',
          },
        });
      }

      return { success: false, message: 'Payment failed' };
    }

    if (event === 'refund.created') {
      // Handle refund
      const { razorpay_refund_id, razorpay_payment_id } = payload.refund.entity;

      const payment = await prisma.payment.findUnique({
        where: { razorpayPaymentId: razorpay_payment_id },
      });

      if (payment) {
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            razorpayRefundId: razorpay_refund_id,
            status: 'refunded',
            refundedAt: new Date(),
          },
        });
      }

      return { success: true, message: 'Refund processed' };
    }

    return { success: true, message: 'Event logged' };
  } catch (error) {
    console.error('Error processing webhook:', error);
    throw error;
  }
};

module.exports = exports;

exports.PAYMENT_ENTITY_TYPES = PAYMENT_ENTITY_TYPES;

exports.getPaymentConfigurations = async () => {
  const rows = await prisma.paymentConfiguration.findMany({ orderBy: { entityType: 'asc' } });
  const byType = new Map(rows.map((row) => [row.entityType, row]));

  return PAYMENT_ENTITY_TYPES.map((entityType) => {
    const found = byType.get(entityType);
    if (found) return found;
    return {
      id: null,
      entityType,
      isEnabled: false,
      amount: null,
      description: null,
      allowManualOverride: true,
      notes: {},
    };
  });
};

exports.requireCompletedPaymentForEntity = async ({ entityType, entityId, userId }) => {
  const config = await exports.getPaymentConfiguration(entityType);
  if (!config.isEnabled) {
    return { required: false, config, payment: null };
  }

  const payment = await prisma.payment.findFirst({
    where: {
      entityType,
      entityId: Number(entityId),
      userId: Number(userId),
      status: 'completed',
    },
    orderBy: { createdAt: 'desc' },
  });

  if (payment) {
    return { required: false, config, payment };
  }

  return { required: true, config, payment: null };
};
