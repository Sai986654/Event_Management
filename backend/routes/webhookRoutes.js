/**
 * Webhook Routes
 * 
 * Routes for receiving form submissions from:
 * - Zapier integrations
 * - Google Forms webhooks
 * - Other form services
 */

const router = require('express').Router();
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const {
  receiveVendorFormWebhook,
  validateVendorFormWebhook,
} = require('../controllers/webhookController');

/**
 * POST /api/webhooks/vendor-form
 * 
 * Receive form submission from Zapier or direct webhook
 * No authentication required (use webhook secret header instead)
 * 
 * Required fields in body:
 * - email: string (valid email)
 * - businessName: string
 * - name: string
 * - phone: string
 * - category: string (catering, photography, etc.)
 * - city: string
 * - state: string
 * 
 * Optional fields:
 * - description: string
 * - website: string
 * - basePrice: number
 * - priceType: string
 * 
 * Headers:
 * - X-Webhook-Secret: (if VENDOR_WEBHOOK_SECRET is set in env)
 */
router.post(
  '/vendor-form',
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('businessName').trim().notEmpty().withMessage('Business name is required'),
    body('name').trim().notEmpty().withMessage('Business owner name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('category').trim().notEmpty().withMessage('Category is required'),
    body('city').trim().notEmpty().withMessage('City is required'),
    body('state').trim().notEmpty().withMessage('State is required'),
    body('description').optional().trim(),
    body('website')
      .optional()
      .trim()
      .customSanitizer((value) => {
        if (!value) return value;
        if (!/^https?:\/\//i.test(value)) {
          return 'https://' + value;
        }
        return value;
      })
      .isURL()
      .withMessage('Invalid website URL'),
    body('basePrice').optional().isFloat({ min: 0 }).withMessage('Price must be >= 0'),
    body('categoryDetails').optional().isObject().withMessage('categoryDetails must be an object'),
  ],
  validate,
  receiveVendorFormWebhook
);

/**
 * POST /api/webhooks/vendor-form/validate
 * 
 * Validate form data without processing
 * Useful for testing Zapier setup
 * 
 * Same body as /vendor-form endpoint
 */
router.post(
  '/vendor-form/validate',
  [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('businessName').optional().trim(),
    body('name').optional().trim(),
    body('phone').optional().trim(),
    body('category').optional().trim(),
    body('categoryDetails').optional().isObject().withMessage('categoryDetails must be an object'),
  ],
  validate,
  validateVendorFormWebhook
);

module.exports = router;
