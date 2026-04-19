/**
 * Vendor Form Sync Service
 * 
 * Syncs vendor registration data from Google Sheets (connected to Google Form)
 * to the database. Handles user creation, vendor profile creation, and status tracking.
 */

const { prisma } = require('../config/db');
const bcrypt = require('bcryptjs');
const { google } = require('googleapis');
const { CATEGORY_FIELD_TEMPLATES } = require('./vendorFormSchemaService');

const CATEGORY_REQUIRED_FIELDS = Object.keys(CATEGORY_FIELD_TEMPLATES).reduce((acc, category) => {
  const fields = CATEGORY_FIELD_TEMPLATES[category] || [];
  acc[category] = fields.filter((f) => f.required).map((f) => f.key);
  return acc;
}, {});

const toObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch (_e) {
    return {};
  }
  return {};
};

const normalizeCategoryDetails = (details) => {
  const raw = toObject(details);
  const normalized = {};
  Object.keys(raw).forEach((key) => {
    const cleanKey = String(key || '').trim();
    if (!cleanKey) return;
    const val = raw[key];
    if (Array.isArray(val)) {
      normalized[cleanKey] = val.map((x) => String(x).trim()).filter(Boolean);
      return;
    }
    normalized[cleanKey] = String(val ?? '').trim();
  });
  return normalized;
};

const formatCategoryDetailsForDescription = (categoryDetails) => {
  const keys = Object.keys(categoryDetails || {});
  if (!keys.length) return '';
  const lines = keys.map((k) => {
    const value = Array.isArray(categoryDetails[k])
      ? categoryDetails[k].join(', ')
      : categoryDetails[k];
    return `- ${k}: ${value}`;
  });
  return `Category Details:\n${lines.join('\n')}`;
};

/**
 * Initialize Google Sheets API client
 * Requires GOOGLE_SHEETS_CREDENTIALS as JSON string in env
 */
function getGoogleSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

/**
 * Fetch responses from Google Sheet
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {string} range - Sheet range (e.g., "Form Responses 1!A1:Z1000")
 * @returns {Promise<Array>} Array of form responses
 */
async function fetchGoogleSheetData(spreadsheetId, range) {
  try {
    const sheets = getGoogleSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    
    const rows = response.data.values || [];
    if (rows.length < 2) return []; // Only headers, no data
    
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, idx) => {
        obj[header.trim()] = row[idx] || '';
      });
      return obj;
    });
    
    return data;
  } catch (error) {
    console.error('[VendorFormSync] Error fetching Google Sheet:', error.message);
    throw error;
  }
}

/**
 * Map form field names to vendor fields
 * Customize this based on your Google Form structure
 */
function mapFormToVendor(formData) {
  const category = (formData['Service Category'] || formData['category'] || '').toLowerCase();
  const categoryDetails = normalizeCategoryDetails(formData.categoryDetails);

  return {
    // User data
    email: formData['Email address'] || formData['email'],
    name: formData['Business Owner Name'] || formData['name'],
    phone: formData['Phone Number'] || formData['contact_phone'],
    
    // Vendor data
    businessName: formData['Business Name'] || formData['business_name'],
    category,
    description: formData['Business Description'] || formData['description'],
    contactPhone: formData['Phone Number'] || formData['contact_phone'],
    contactEmail: formData['Email address'] || formData['email'],
    city: formData['City'] || formData['city'],
    state: formData['State'] || formData['state'],
    website: formData['Website'] || formData['website'],
    basePrice: parseFloat(formData['Base Price'] || 0),
    currency: formData['Currency'] || 'INR',
    priceType: formData['Price Type'] || 'fixed',
    categoryDetails,
    
    // For tracking sync
    formTimestamp: formData['Timestamp'] || new Date().toISOString(),
  };
}

/**
 * Validate and sanitize vendor data
 */
function validateVendorData(data) {
  const errors = [];
  
  if (!data.email || !data.email.includes('@')) {
    errors.push('Invalid email address');
  }
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Invalid business owner name');
  }
  if (!data.businessName || data.businessName.trim().length < 2) {
    errors.push('Invalid business name');
  }
  if (!data.category) {
    errors.push('Invalid service category');
  }

  const requiredFields = CATEGORY_REQUIRED_FIELDS[data.category] || CATEGORY_REQUIRED_FIELDS.other || [];
  requiredFields.forEach((field) => {
    const val = data.categoryDetails?.[field];
    const missing =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && !val.trim()) ||
      (Array.isArray(val) && val.length === 0);
    if (missing) {
      errors.push(`Missing required category field: ${field}`);
    }
  });
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if vendor already exists
 */
async function vendorExists(email) {
  const user = await prisma.user.findUnique({
    where: { email },
  });
  return !!user;
}

/**
 * Create or update user and vendor profile from form data
 */
async function syncVendorFromForm(formData) {
  try {
    const mapped = mapFormToVendor(formData);
    const validation = validateVendorData(mapped);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(', '),
        status: 'validation_failed',
      };
    }
    
    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: mapped.email },
    });
    
    if (user) {
      // User exists - check if already a vendor
      const existingVendor = await prisma.vendor.findUnique({
        where: { userId: user.id },
      });
      
      if (existingVendor) {
        return {
          success: false,
          error: 'Vendor profile already exists for this email',
          status: 'already_exists',
          vendorId: existingVendor.id,
        };
      }
    } else {
      // Create new user
      const hashedPassword = await bcrypt.hash(
        Math.random().toString(36).slice(-8),
        10
      );
      
      user = await prisma.user.create({
        data: {
          name: mapped.name,
          email: mapped.email,
          phone: mapped.phone,
          password: hashedPassword,
          role: 'vendor',
          isActive: true,
        },
      });
    }
    
    const detailsSummary = formatCategoryDetailsForDescription(mapped.categoryDetails);
    const finalDescription = [mapped.description || '', detailsSummary]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    // Create vendor profile
    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        businessName: mapped.businessName,
        category: mapped.category,
        description: finalDescription,
        contactPhone: mapped.contactPhone,
        contactEmail: mapped.contactEmail,
        city: mapped.city,
        state: mapped.state,
        website: mapped.website,
        basePrice: mapped.basePrice,
        currency: mapped.currency,
        priceType: mapped.priceType,
        verificationStatus: 'pending',
        isVerified: false,
      },
    });
    
    return {
      success: true,
      userId: user.id,
      vendorId: vendor.id,
      status: 'created',
      message: `Vendor created successfully. Admin review pending.`,
    };
  } catch (error) {
    console.error('[VendorFormSync] Error syncing vendor:', error.message);
    return {
      success: false,
      error: error.message,
      status: 'sync_error',
    };
  }
}

/**
 * Main sync function - fetches form data and creates vendor profiles
 * @param {object} options - { spreadsheetId, range, limit }
 */
async function syncVendorsFromGoogleForm(options = {}) {
  const {
    spreadsheetId = process.env.GOOGLE_FORM_SHEET_ID,
    range = process.env.GOOGLE_FORM_RANGE || 'Form Responses 1!A2:Z1000',
    limit = 50,
  } = options;
  
  if (!spreadsheetId) {
    throw new Error('GOOGLE_FORM_SHEET_ID not configured in environment');
  }
  
  try {
    console.log('[VendorFormSync] Starting sync...');
    const formData = await fetchGoogleSheetData(spreadsheetId, range);
    
    const results = {
      processed: 0,
      created: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };
    
    // Process up to limit
    for (const row of formData.slice(0, limit)) {
      // Skip empty rows
      if (!row.email && !row['Email address']) {
        results.skipped++;
        continue;
      }
      
      // Check for duplicates before syncing
      const email = row['Email address'] || row.email;
      if (await vendorExists(email)) {
        results.skipped++;
        continue;
      }
      
      const syncResult = await syncVendorFromForm(row);
      
      results.processed++;
      if (syncResult.success) {
        results.created++;
        console.log(`[VendorFormSync] ✓ Created vendor: ${syncResult.vendorId}`);
      } else {
        results.failed++;
        results.errors.push({
          email: row['Email address'] || row.email,
          error: syncResult.error,
        });
        console.warn(`[VendorFormSync] ✗ Failed: ${syncResult.error}`);
      }
    }
    
    console.log('[VendorFormSync] Sync completed:', results);
    return results;
  } catch (error) {
    console.error('[VendorFormSync] Sync failed:', error.message);
    throw error;
  }
}

module.exports = {
  CATEGORY_REQUIRED_FIELDS,
  fetchGoogleSheetData,
  mapFormToVendor,
  validateVendorData,
  syncVendorFromForm,
  syncVendorsFromGoogleForm,
  getGoogleSheetsClient,
};
