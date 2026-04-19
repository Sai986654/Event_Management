/**
 * Google Apps Script: push Google Form submissions directly to your webhook.
 *
 * Steps:
 * 1) Open your Google Form > Script editor
 * 2) Replace all code with this file
 * 3) Run setupDynamicCategoryForm() once from script editor
 * 4) Save
 * 5) Create trigger: Function=onFormSubmit, Event=On form submit
 */

const WEBHOOK_URL = 'https://event-management-9i4d.onrender.com/api/webhooks/vendor-form';
const SCHEMA_URL = 'https://event-management-9i4d.onrender.com/api/public/vendor-form/schema';
const WEBHOOK_SECRET = '9783320eea44145b46dc6e79f7b2124e5c72245d9e5a1695';
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
    .split(/[_s]+/)
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

function getOrCreateCategoryItem(form) {
  const existing = findItemByTitle(form, FormApp.ItemType.MULTIPLE_CHOICE, CATEGORY_ITEM_TITLE);
  if (existing) return existing.asMultipleChoiceItem();
  return form.addMultipleChoiceItem().setTitle(CATEGORY_ITEM_TITLE).setRequired(true);
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
  const categoryItem = getOrCreateCategoryItem(form);
  const schema = getSchema();
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

  Logger.log('Dynamic category form setup complete.');
}

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase().replace(/s+/g, '_');
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
    basePrice: Number(byTitle['Base Price'] || 0),
    priceType: (byTitle['Price Type'] || 'fixed').toString().toLowerCase().replace(/s+/g, '_'),
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
