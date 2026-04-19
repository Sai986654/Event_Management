const { prisma } = require('../config/db');

const DEFAULT_CATEGORIES = [
  { name: 'catering', label: 'Catering' },
  { name: 'decor', label: 'Decor' },
  { name: 'photography', label: 'Photography' },
  { name: 'videography', label: 'Videography' },
  { name: 'music', label: 'Music' },
  { name: 'venue', label: 'Venue' },
  { name: 'florist', label: 'Florist' },
  { name: 'transportation', label: 'Transportation' },
  { name: 'other', label: 'Other' },
];

const CATEGORY_FIELD_TEMPLATES = {
  catering: [
    { key: 'serviceType', title: 'Catering Service Type', type: 'multiple', choices: ['Veg', 'Non-Veg', 'Both'], required: true },
    { key: 'maxGuests', title: 'Max Guests You Can Serve', type: 'text', required: true },
    { key: 'cuisineTypes', title: 'Cuisine Types', type: 'checkbox', choices: ['South Indian', 'North Indian', 'Chinese', 'Continental', 'Desserts'], required: false },
    { key: 'liveCounters', title: 'Live Counters Available?', type: 'multiple', choices: ['Yes', 'No'], required: false },
  ],
  decor: [
    { key: 'decorStyle', title: 'Decor Style Focus', type: 'multiple', choices: ['Traditional', 'Modern', 'Floral', 'Theme-based'], required: true },
    { key: 'setupLeadHours', title: 'Setup Lead Time (hours)', type: 'text', required: true },
    { key: 'indoorOutdoor', title: 'Indoor / Outdoor Setup', type: 'multiple', choices: ['Indoor', 'Outdoor', 'Both'], required: false },
    { key: 'materialFocus', title: 'Material Focus', type: 'checkbox', choices: ['Fresh Flowers', 'Fabric', 'Lighting', 'Props'], required: false },
  ],
  photography: [
    { key: 'photoStyles', title: 'Photography Styles', type: 'checkbox', choices: ['Candid', 'Traditional', 'Cinematic', 'Drone'], required: true },
    { key: 'deliveryDays', title: 'Photo Delivery Timeline (days)', type: 'text', required: true },
    { key: 'teamSize', title: 'Team Size', type: 'text', required: false },
    { key: 'albumIncluded', title: 'Album Included?', type: 'multiple', choices: ['Yes', 'No'], required: false },
  ],
  videography: [
    { key: 'videoStyles', title: 'Videography Styles', type: 'checkbox', choices: ['Cinematic', 'Traditional', 'Teaser'], required: true },
    { key: 'deliveryDays', title: 'Video Delivery Timeline (days)', type: 'text', required: true },
    { key: 'droneIncluded', title: 'Drone Included?', type: 'multiple', choices: ['Yes', 'No'], required: false },
    { key: 'rawFootageProvided', title: 'Raw Footage Provided?', type: 'multiple', choices: ['Yes', 'No'], required: false },
  ],
  music: [
    { key: 'performanceType', title: 'Performance Type', type: 'multiple', choices: ['DJ', 'Live Band', 'Singer', 'Instrumental'], required: true },
    { key: 'teamSize', title: 'Team Size', type: 'text', required: true },
    { key: 'soundSetupIncluded', title: 'Sound Setup Included?', type: 'multiple', choices: ['Yes', 'No'], required: false },
    { key: 'languages', title: 'Languages Performed', type: 'checkbox', choices: ['Telugu', 'Hindi', 'Tamil', 'English', 'Kannada'], required: false },
  ],
  venue: [
    { key: 'capacity', title: 'Venue Capacity', type: 'text', required: true },
    { key: 'indoorOutdoor', title: 'Indoor / Outdoor', type: 'multiple', choices: ['Indoor', 'Outdoor', 'Both'], required: true },
    { key: 'roomsAvailable', title: 'Rooms Available?', type: 'multiple', choices: ['Yes', 'No'], required: false },
    { key: 'parkingAvailable', title: 'Parking Available?', type: 'multiple', choices: ['Yes', 'No'], required: false },
  ],
  florist: [
    { key: 'flowerSpecialty', title: 'Flower Specialty', type: 'text', required: true },
    { key: 'bookingLeadDays', title: 'Preferred Booking Lead Time (days)', type: 'text', required: true },
    { key: 'freshOrArtificial', title: 'Fresh / Artificial', type: 'multiple', choices: ['Fresh', 'Artificial', 'Both'], required: false },
    { key: 'customDesigns', title: 'Custom Designs?', type: 'multiple', choices: ['Yes', 'No'], required: false },
  ],
  transportation: [
    { key: 'fleetType', title: 'Fleet Type', type: 'multiple', choices: ['Cars', 'Luxury Cars', 'Buses', 'Mixed'], required: true },
    { key: 'vehicleCount', title: 'Number of Vehicles', type: 'text', required: true },
    { key: 'chauffeurIncluded', title: 'Chauffeur Included?', type: 'multiple', choices: ['Yes', 'No'], required: false },
    { key: 'outstationService', title: 'Outstation Service?', type: 'multiple', choices: ['Yes', 'No'], required: false },
  ],
  other: [
    { key: 'serviceOverview', title: 'Service Overview', type: 'paragraph', required: true },
    { key: 'specialRequirements', title: 'Special Requirements You Handle', type: 'paragraph', required: false },
  ],
};

const BASE_FIELDS = [
  { key: 'email', title: 'Email address', type: 'text', required: true },
  { key: 'name', title: 'Business Owner Name', type: 'text', required: true },
  { key: 'businessName', title: 'Business Name', type: 'text', required: true },
  { key: 'phone', title: 'Phone Number', type: 'text', required: true },
  { key: 'category', title: 'Service Category', type: 'multiple', required: true },
  { key: 'description', title: 'Business Description', type: 'paragraph', required: false },
  { key: 'city', title: 'City', type: 'text', required: true },
  { key: 'state', title: 'State', type: 'text', required: true },
  { key: 'website', title: 'Website', type: 'text', required: false },
  { key: 'basePrice', title: 'Base Price', type: 'text', required: false },
  { key: 'priceType', title: 'Price Type', type: 'multiple', choices: ['fixed', 'per_person', 'hourly', 'custom'], required: false },
];

const normalizeSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

async function getCategoryOptions() {
  const fromDb = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { name: true, label: true },
  });

  if (fromDb.length > 0) {
    return fromDb.map((c) => ({
      name: normalizeSlug(c.name),
      label: c.label || c.name,
    }));
  }

  return DEFAULT_CATEGORIES;
}

function getCategoryFieldTemplates() {
  return CATEGORY_FIELD_TEMPLATES;
}

async function getVendorFormSchema() {
  const categories = await getCategoryOptions();

  return {
    version: '2026-04-19',
    generatedAt: new Date().toISOString(),
    baseFields: BASE_FIELDS,
    categories: categories.map((c) => ({
      name: c.name,
      label: c.label,
      fields: CATEGORY_FIELD_TEMPLATES[c.name] || CATEGORY_FIELD_TEMPLATES.other || [],
    })),
  };
}

module.exports = {
  CATEGORY_FIELD_TEMPLATES,
  getCategoryFieldTemplates,
  getCategoryOptions,
  getVendorFormSchema,
};
