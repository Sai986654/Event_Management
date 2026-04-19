#!/usr/bin/env node
/*
 * One-time bootstrap for vendor webhook onboarding.
 * Generates:
 * - .env snippet with webhook secret
 * - ready-to-run curl test command
 * - ready-to-paste Google Apps Script template
 * - sample JSON payload for Zapier or manual testing
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const cwd = process.cwd();
const projectRoot = path.resolve(cwd, '..');
const outputDir = path.join(projectRoot, 'automation', 'vendor-webhook');

function parseArg(name, fallback = '') {
  const prefix = `--${name}=`;
  const item = process.argv.find((arg) => arg.startsWith(prefix));
  return item ? item.slice(prefix.length) : fallback;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function normalizeBaseUrl(input) {
  const raw = (input || '').trim().replace(/\/+$/, '');
  if (!raw) return '';
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

function buildAppsScript(endpoint, secret) {
  const schemaUrl = endpoint.replace(/\/api\/webhooks\/vendor-form$/, '/api/public/vendor-form/schema');

  return `/**
 * Google Apps Script: push Google Form submissions directly to your webhook.
 *
 * Steps:
 * 1) Open your Google Form > Script editor
 * 2) Replace all code with this file
 * 3) Run rebuildDynamicCategoryForm() once from script editor
 * 4) Save
 * 5) Create trigger: Function=onFormSubmit, Event=On form submit
 */

const WEBHOOK_URL = '${endpoint}';
const SCHEMA_URL = '${schemaUrl}';
const WEBHOOK_SECRET = '${secret}';
const CATEGORY_ITEM_TITLE = 'Service Category';

const FALLBACK_SCHEMA = {
  categories: [
    { name: 'catering', label: 'Catering', fields: [
      { key: 'serviceType', title: 'Catering Service Type', type: 'multiple', choices: ['Veg', 'Non-Veg', 'Both'], required: true },
      { key: 'maxGuests', title: 'Max Guests You Can Serve', type: 'text', required: true },
    ] },
    { name: 'decor', label: 'Decor', fields: [
      { key: 'decorStyle', title: 'Decor Style Focus', type: 'multiple', choices: ['Traditional', 'Modern', 'Floral', 'Theme-based'], required: true },
      { key: 'setupLeadHours', title: 'Setup Lead Time (hours)', type: 'text', required: true },
    ] },
    { name: 'photography', label: 'Photography', fields: [
      { key: 'photoStyles', title: 'Photography Styles', type: 'checkbox', choices: ['Candid', 'Traditional', 'Cinematic', 'Drone'], required: true },
      { key: 'deliveryDays', title: 'Photo Delivery Timeline (days)', type: 'text', required: true },
    ] },
    { name: 'videography', label: 'Videography', fields: [
      { key: 'videoStyles', title: 'Videography Styles', type: 'checkbox', choices: ['Cinematic', 'Traditional', 'Teaser'], required: true },
      { key: 'deliveryDays', title: 'Video Delivery Timeline (days)', type: 'text', required: true },
    ] },
    { name: 'music', label: 'Music', fields: [
      { key: 'performanceType', title: 'Performance Type', type: 'multiple', choices: ['DJ', 'Live Band', 'Singer', 'Instrumental'], required: true },
      { key: 'teamSize', title: 'Team Size', type: 'text', required: true },
    ] },
    { name: 'venue', label: 'Venue', fields: [
      { key: 'capacity', title: 'Venue Capacity', type: 'text', required: true },
      { key: 'indoorOutdoor', title: 'Indoor / Outdoor', type: 'multiple', choices: ['Indoor', 'Outdoor', 'Both'], required: true },
    ] },
    { name: 'florist', label: 'Florist', fields: [
      { key: 'flowerSpecialty', title: 'Flower Specialty', type: 'text', required: true },
      { key: 'bookingLeadDays', title: 'Preferred Booking Lead Time (days)', type: 'text', required: true },
    ] },
    { name: 'transportation', label: 'Transportation', fields: [
      { key: 'fleetType', title: 'Fleet Type', type: 'multiple', choices: ['Cars', 'Luxury Cars', 'Buses', 'Mixed'], required: true },
      { key: 'vehicleCount', title: 'Number of Vehicles', type: 'text', required: true },
    ] },
    { name: 'other', label: 'Other', fields: [] },
  ],
};

function getSchema() {
  try {
    const res = UrlFetchApp.fetch(SCHEMA_URL, { muteHttpExceptions: true });
    if (res.getResponseCode() >= 200 && res.getResponseCode() < 300) {
      const parsed = JSON.parse(res.getContentText());
      if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    Logger.log('Schema fetch failed, using fallback: %s', e.message);
  }
  return FALLBACK_SCHEMA;
}

function titleCase(value) {
  return String(value || '')
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function findItemByTitle(form, itemType, title) {
  const items = form.getItems(itemType);
  for (var i = 0; i < items.length; i++) {
    if (items[i].getTitle() === title) return items[i];
  }
  return null;
}

function isGeneratedCategoryItem(title) {
  return String(title || '').startsWith('[');
}

function isGeneratedCategorySection(title) {
  return String(title || '').startsWith('Category: ');
}

function deleteGeneratedCategoryItems() {
  const form = FormApp.getActiveForm();
  const items = form.getItems();

  for (var i = items.length - 1; i >= 0; i--) {
    var item = items[i];
    var title = '';

    try {
      title = item.getTitle ? item.getTitle() : '';
    } catch (_e) {
      title = '';
    }

    if (isGeneratedCategoryItem(title) || isGeneratedCategorySection(title)) {
      form.deleteItem(item);
    }
  }
}

function getOrCreateCategoryItem(form) {
  const existing = findItemByTitle(form, FormApp.ItemType.MULTIPLE_CHOICE, CATEGORY_ITEM_TITLE);
  if (existing) return existing.asMultipleChoiceItem();
  return form.addMultipleChoiceItem().setTitle(CATEGORY_ITEM_TITLE).setRequired(true);
}

function ensureStandaloneFieldItem(form, field) {
  const title = field.title;

  if (field.type === 'multiple') {
    const existing = findItemByTitle(form, FormApp.ItemType.MULTIPLE_CHOICE, title);
    const item = existing ? existing.asMultipleChoiceItem() : form.addMultipleChoiceItem().setTitle(title);
    item.setChoiceValues(field.choices || []);
    item.setRequired(!!field.required);
    return item;
  }

  if (field.type === 'checkbox') {
    const existing = findItemByTitle(form, FormApp.ItemType.CHECKBOX, title);
    const item = existing ? existing.asCheckboxItem() : form.addCheckboxItem().setTitle(title);
    item.setChoiceValues(field.choices || []);
    item.setRequired(!!field.required);
    return item;
  }

  if (field.type === 'paragraph') {
    const existing = findItemByTitle(form, FormApp.ItemType.PARAGRAPH_TEXT, title);
    const item = existing ? existing.asParagraphTextItem() : form.addParagraphTextItem().setTitle(title);
    item.setRequired(!!field.required);
    return item;
  }

  const existing = findItemByTitle(form, FormApp.ItemType.TEXT, title);
  const item = existing ? existing.asTextItem() : form.addTextItem().setTitle(title);
  item.setRequired(!!field.required);
  return item;
}

function ensureFieldItem(form, category, field) {
  const title = '[' + category + '] ' + field.title;

  if (field.type === 'multiple') {
    const existing = findItemByTitle(form, FormApp.ItemType.MULTIPLE_CHOICE, title);
    const item = existing ? existing.asMultipleChoiceItem() : form.addMultipleChoiceItem().setTitle(title);
    item.setChoiceValues(field.choices || []);
    item.setRequired(!!field.required);
    return;
  }

  if (field.type === 'checkbox') {
    const existing = findItemByTitle(form, FormApp.ItemType.CHECKBOX, title);
    const item = existing ? existing.asCheckboxItem() : form.addCheckboxItem().setTitle(title);
    item.setChoiceValues(field.choices || []);
    item.setRequired(!!field.required);
    return;
  }

  if (field.type === 'paragraph') {
    const existing = findItemByTitle(form, FormApp.ItemType.PARAGRAPH_TEXT, title);
    const item = existing ? existing.asParagraphTextItem() : form.addParagraphTextItem().setTitle(title);
    item.setRequired(!!field.required);
    return;
  }

  const existing = findItemByTitle(form, FormApp.ItemType.TEXT, title);
  const item = existing ? existing.asTextItem() : form.addTextItem().setTitle(title);
  item.setRequired(!!field.required);
}

function setupDynamicCategoryForm() {
  const form = FormApp.getActiveForm();
  const schema = getSchema();
  const baseFields = schema.baseFields || [];

  baseFields.forEach(function (field) {
    if (field.key === 'category') return;
    ensureStandaloneFieldItem(form, field);
  });

  const categoryItem = getOrCreateCategoryItem(form);

  var categoryField = baseFields.find(function (field) { return field.key === 'category'; });
  if (categoryField && categoryField.choices && categoryField.choices.length) {
    categoryItem.setChoiceValues(categoryField.choices);
  }

  const categories = (schema.categories || []).map(function (c) {
    return {
      name: normalizeCategory(c.name || c.label),
      label: c.label || titleCase(c.name),
      fields: c.fields || [],
    };
  });
  const sectionMap = {};

  categories.forEach(function (categoryObj) {
    const category = categoryObj.name;
    const sectionTitle = 'Category: ' + categoryObj.label;
    var existingSection = findItemByTitle(form, FormApp.ItemType.PAGE_BREAK, sectionTitle);
    var section = existingSection ? existingSection.asPageBreakItem() : form.addPageBreakItem().setTitle(sectionTitle);
    section.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    sectionMap[category] = section;

    (categoryObj.fields || []).forEach(function (field) {
      ensureFieldItem(form, category, field);
    });
  });

  const choices = categories.map(function (categoryObj) {
    return categoryItem.createChoice(categoryObj.label, sectionMap[categoryObj.name]);
  });
  categoryItem.setChoices(choices);

  Logger.log('Dynamic category form setup complete. Categories: %s', categories.length);
  categories.forEach(function (categoryObj) {
    Logger.log('Category %s -> %s field(s)', categoryObj.label, (categoryObj.fields || []).length);
  });
}

function rebuildDynamicCategoryForm() {
  Logger.log('Rebuilding form from live backend schema...');
  deleteGeneratedCategoryItems();
  setupDynamicCategoryForm();
  Logger.log('Rebuild complete. Refresh the Google Form editor page now.');
}

function debugVendorFormSchema() {
  var schema = getSchema();
  Logger.log('Schema fetched only. This does not change the form.');
  Logger.log(JSON.stringify(schema));
}

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function extractCategoryDetails(byTitle, category) {
  const details = {};
  const schema = getSchema();
  const match = (schema.categories || []).find(function (c) {
    const name = normalizeCategory(c.name || c.label);
    return name === category;
  });
  const config = match ? match.fields || [] : [];

  config.forEach(function (field) {
    var key = '[' + category + '] ' + field.title;
    var answer = byTitle[key];
    if (Array.isArray(answer)) {
      details[field.key] = answer.filter(Boolean);
      return;
    }
    if (answer !== undefined && answer !== null && String(answer).trim() !== '') {
      details[field.key] = String(answer).trim();
    }
  });

  return details;
}

function onFormSubmit(e) {
  const responses = e.response.getItemResponses();
  const byTitle = {};

  responses.forEach((r) => {
    byTitle[r.getItem().getTitle()] = r.getResponse();
  });

  const normalizedCategory = normalizeCategory(byTitle[CATEGORY_ITEM_TITLE] || byTitle['category']);
  const categoryDetails = extractCategoryDetails(byTitle, normalizedCategory);

  // Update these labels only if your base form labels are different.
  const payload = {
    email: byTitle['Email address'] || byTitle['Email'] || '',
    businessName: byTitle['Business Name'] || '',
    name: byTitle['Business Owner Name'] || byTitle['Owner Name'] || '',
    phone: byTitle['Phone Number'] || byTitle['Phone'] || '',
    category: normalizedCategory,
    city: byTitle['City'] || '',
    state: byTitle['State'] || '',
    description: byTitle['Business Description'] || '',
    website: byTitle['Website'] || '',
    portfolioLinks: byTitle['Portfolio Media Links (public image/video URLs, one per line)'] || '',
    driveFolderUrl: byTitle['Google Drive Folder URL'] || '',
    instagram: byTitle['Instagram Profile URL'] || '',
    facebook: byTitle['Facebook Page URL'] || '',
    youtube: byTitle['YouTube / Reel URL'] || '',
    testimonial1ClientName: byTitle['Testimonial 1 - Client Name'] || '',
    testimonial1Rating: byTitle['Testimonial 1 - Rating'] || '',
    testimonial1Content: byTitle['Testimonial 1 - Feedback'] || '',
    testimonial1Source: byTitle['Testimonial 1 - Source (Wedding/Event Name)'] || '',
    testimonial2ClientName: byTitle['Testimonial 2 - Client Name'] || '',
    testimonial2Rating: byTitle['Testimonial 2 - Rating'] || '',
    testimonial2Content: byTitle['Testimonial 2 - Feedback'] || '',
    testimonial2Source: byTitle['Testimonial 2 - Source (Wedding/Event Name)'] || '',
    testimonial3ClientName: byTitle['Testimonial 3 - Client Name'] || '',
    testimonial3Rating: byTitle['Testimonial 3 - Rating'] || '',
    testimonial3Content: byTitle['Testimonial 3 - Feedback'] || '',
    testimonial3Source: byTitle['Testimonial 3 - Source (Wedding/Event Name)'] || '',
    basePrice: Number(byTitle['Base Price'] || 0),
    priceType: (byTitle['Price Type'] || 'fixed').toString().toLowerCase().replace(/\s+/g, '_'),
    categoryDetails: categoryDetails,
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-Webhook-Secret': WEBHOOK_SECRET,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  const res = UrlFetchApp.fetch(WEBHOOK_URL, options);
  Logger.log('Vendor webhook status: %s', res.getResponseCode());
  Logger.log('Vendor webhook response: %s', res.getContentText());
}
`;
}

function buildTestPayload() {
  return {
    email: 'demo.vendor@example.com',
    businessName: 'Demo Catering Co',
    name: 'Demo Owner',
    phone: '+91-90000-00000',
    category: 'catering',
    city: 'Mumbai',
    state: 'Maharashtra',
    description: 'End-to-end catering for weddings and corporate events.',
    website: 'https://democatering.example',
    basePrice: 50000,
    priceType: 'fixed',
  };
}

async function maybePingValidate(url, secret) {
  if (!url) return null;
  const testUrl = `${url}/api/webhooks/vendor-form/validate`;
  try {
    const payload = buildTestPayload();
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': secret,
      },
      body: JSON.stringify(payload),
    });

    const body = await response.text();
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return { ok: false, status: 0, body: error.message };
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(parseArg('base-url', ''));
  const providedSecret = parseArg('secret', '');
  const secret = providedSecret || crypto.randomBytes(24).toString('hex');

  if (!baseUrl) {
    console.error('Missing required arg: --base-url=https://your-domain.com');
    process.exit(1);
  }

  ensureDir(outputDir);

  const endpoint = `${baseUrl}/api/webhooks/vendor-form`;
  const envSnippetPath = path.join(outputDir, '.env.vendor-webhook');
  const payloadPath = path.join(outputDir, 'sample-vendor-payload.json');
  const curlPath = path.join(outputDir, 'test-vendor-webhook.cmd.txt');
  const scriptPath = path.join(outputDir, 'google-apps-script.gs');

  writeFile(
    envSnippetPath,
    `# Add this to backend/.env\nVENDOR_WEBHOOK_SECRET=${secret}\n\n# Optional: keep this unset if not needed\n# GOOGLE_FORM_SHEET_ID=\n`
  );

  writeFile(payloadPath, `${JSON.stringify(buildTestPayload(), null, 2)}\n`);

  writeFile(
    curlPath,
    `curl -X POST "${endpoint}" ^\n  -H "Content-Type: application/json" ^\n  -H "X-Webhook-Secret: ${secret}" ^\n  --data-binary @"${payloadPath}"\n`
  );

  writeFile(scriptPath, buildAppsScript(endpoint, secret));

  const ping = await maybePingValidate(baseUrl, secret);

  console.log('Vendor webhook bootstrap complete.');
  console.log(`Output folder: ${outputDir}`);
  console.log(`1) Copy ${envSnippetPath} into backend/.env`);
  console.log(`2) Paste ${scriptPath} into Google Form Apps Script`);
  console.log(`3) Run test command from ${curlPath}`);

  if (ping) {
    console.log(`Validation ping: status=${ping.status}, ok=${ping.ok}`);
    console.log(`Validation response: ${ping.body}`);
  }
}

main().catch((error) => {
  console.error('Bootstrap failed:', error.message);
  process.exit(1);
});
