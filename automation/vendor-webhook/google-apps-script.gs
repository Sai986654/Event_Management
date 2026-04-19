/**
 * Google Apps Script: push Google Form submissions directly to your webhook.
 *
 * Steps:
 * 1) Open your Google Form > Script editor
 * 2) Replace all code with this file
 * 3) Run rebuildDynamicCategoryForm() once from script editor
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

function isGeneratedCategoryItem(title) {
  return String(title || '').startsWith('[');
}

function isGeneratedCategorySection(title) {
  return String(title || '').startsWith('Category: ');
}

function deleteGeneratedCategoryItems() {
  const form = FormApp.getActiveForm();
  const categoryItem = getOrCreateCategoryItem(form);

  // Break existing section-navigation links before deleting section items.
  categoryItem.setChoices([
    categoryItem.createChoice('Refreshing categories...', FormApp.PageNavigationType.SUBMIT),
  ]);

  const items = form.getItems();
  const deleteIndexes = [];

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var title = '';

    try {
      title = item.getTitle ? item.getTitle() : '';
    } catch (_e) {
      title = '';
    }

    if (isGeneratedCategoryItem(title) || isGeneratedCategorySection(title)) {
      deleteIndexes.push(i);
    }
  }

  for (var j = deleteIndexes.length - 1; j >= 0; j--) {
    try {
      form.deleteItem(deleteIndexes[j]);
    } catch (e) {
      Logger.log('Skipping item delete at index %s: %s', deleteIndexes[j], e.message);
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

function submitVendorWebhookFromResponse(response, sourceLabel) {
  const responses = response.getItemResponses();
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
  Logger.log('[%s] Vendor webhook status: %s', sourceLabel || 'submit', res.getResponseCode());
  Logger.log('[%s] Vendor webhook response: %s', sourceLabel || 'submit', res.getContentText());
}

function replayLatestResponse() {
  const form = FormApp.getActiveForm();
  const allResponses = form.getResponses();

  if (!allResponses.length) {
    Logger.log('No saved form responses found to replay.');
    return;
  }

  const latest = allResponses[allResponses.length - 1];
  submitVendorWebhookFromResponse(latest, 'replay-latest');
}

function replayResponseByNumber(responseNumber) {
  const form = FormApp.getActiveForm();
  const allResponses = form.getResponses();
  const idx = Number(responseNumber) - 1;

  if (!allResponses.length) {
    Logger.log('No saved form responses found to replay.');
    return;
  }

  if (!Number.isInteger(idx) || idx < 0 || idx >= allResponses.length) {
    Logger.log('Invalid responseNumber=%s. Valid range is 1..%s', responseNumber, allResponses.length);
    return;
  }

  submitVendorWebhookFromResponse(allResponses[idx], 'replay-' + responseNumber);
}

function onFormSubmit(e) {
  submitVendorWebhookFromResponse(e.response, 'trigger');
}
