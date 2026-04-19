const router = require('express').Router();
const { getPublicVendorFormSchema } = require('../controllers/vendorFormSchemaController');

// Public endpoint for Google Apps Script to fetch latest vendor form schema
router.get('/vendor-form/schema', getPublicVendorFormSchema);

module.exports = router;
