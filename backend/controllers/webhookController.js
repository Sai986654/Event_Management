/**
 * Vendor Form Webhook Receiver
 * 
 * Receives form submissions from:
 * - Zapier (Google Forms → Zapier → Your API)
 * - Direct webhook from form services
 * - Manual triggers via API
 * 
 * Syncs vendor data to database immediately (no delays!)
 */

const { prisma } = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { syncVendorFromForm } = require('../services/vendorFormSyncService');
const { sendSubmissionConfirmationEmail } = require('../services/vendorEmailService');

/**
 * POST /api/webhooks/vendor-form
 * 
 * Receives form submission from Zapier or direct webhook
 * 
 * Example payload (from Zapier):
 * {
 *   "email": "vendor@example.com",
 *   "businessName": "ABC Catering",
 *   "name": "John Smith",
 *   "phone": "+91-XXXXX-XXXXX",
 *   "category": "catering",
 *   "city": "Mumbai",
 *   "state": "Maharashtra",
 *   "description": "Premium catering services",
 *   "website": "www.abccatering.com",
 *   "basePrice": 50000
 * }
 */
exports.receiveVendorFormWebhook = asyncHandler(async (req, res) => {
  try {
    const formData = req.body;

    // Verify webhook secret (optional but recommended)
    const webhookSecret = req.headers['x-webhook-secret'];
    if (process.env.VENDOR_WEBHOOK_SECRET && webhookSecret !== process.env.VENDOR_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    // Log incoming webhook
    console.log('[VendorWebhook] Received form submission:', formData.email);

    // Sync vendor immediately (no delay!)
    const syncResult = await syncVendorFromForm(formData);

    if (!syncResult.success) {
      console.warn('[VendorWebhook] Sync failed:', syncResult.error);
      return res.status(400).json({
        message: 'Sync failed',
        error: syncResult.error,
        status: syncResult.status,
      });
    }

    // Get vendor details for email
    const vendor = await prisma.vendor.findUnique({
      where: { id: syncResult.vendorId },
      include: { user: true },
    });

    // Send confirmation email immediately
    try {
      await sendSubmissionConfirmationEmail(vendor);
      console.log('[VendorWebhook] Confirmation email sent to:', vendor.contactEmail);
    } catch (emailError) {
      console.warn('[VendorWebhook] Email failed (but vendor created):', emailError.message);
    }

    console.log('[VendorWebhook] ✓ Successfully processed:', syncResult.vendorId);

    // Return success with vendor details
    res.status(201).json({
      message: 'Vendor registration successful',
      vendorId: syncResult.vendorId,
      userId: syncResult.userId,
      email: formData.email,
      businessName: formData.businessName,
      status: 'pending_admin_review',
      nextSteps: [
        'Confirmation email sent to vendor',
        'Admin will review within 24-48 hours',
        'Vendor will receive approval email with login credentials',
      ],
    });
  } catch (error) {
    console.error('[VendorWebhook] Unexpected error:', error.message);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
    });
  }
});

/**
 * POST /api/webhooks/vendor-form/validate
 * 
 * Validate webhook setup without processing
 * Useful for testing Zapier or other integrations
 */
exports.validateVendorFormWebhook = asyncHandler(async (req, res) => {
  const formData = req.body;
  const { validateVendorData } = require('../services/vendorFormSyncService');

  const validation = validateVendorData(formData);

  if (!validation.isValid) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: validation.errors,
    });
  }

  res.json({
    message: 'Validation successful',
    isValid: true,
    vendor: {
      email: formData.email,
      businessName: formData.businessName,
      name: formData.name,
      category: formData.category,
    },
  });
});

module.exports = {
  receiveVendorFormWebhook,
  validateVendorFormWebhook,
};
