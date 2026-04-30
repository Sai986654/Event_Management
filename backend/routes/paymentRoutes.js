const express = require('express');
const paymentController = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Webhook endpoint for Razorpay events (No auth)
router.post('/webhook/razorpay', paymentController.handleWebhook);

// All non-webhook routes require authentication
router.use(protect);

// ── Payment Endpoints ───────────────────────────────────────

// Initiate a payment
router.post('/initiate', paymentController.initiatePayment);

// Verify payment after completion
router.post('/verify', paymentController.verifyPayment);

// Get payment requirement for a specific entity and id
router.get('/requirements/:entityType/:entityId', paymentController.getPaymentRequirement);

// Admin payment configuration endpoints
router.get('/configurations', authorize('admin'), paymentController.getPaymentConfigurations);
router.put('/configurations/:entityType', authorize('admin'), paymentController.upsertPaymentConfiguration);

// Get payment details
router.get('/:paymentId', paymentController.getPaymentDetails);

// Get user's payment history
router.get('/', paymentController.getUserPayments);

// Refund a payment (user or admin only)
router.post('/:paymentId/refund', paymentController.refundPayment);

module.exports = router;
