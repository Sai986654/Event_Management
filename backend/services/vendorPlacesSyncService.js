/**
 * Vendor Places Sync Service
 *
 * Imports business data from Google Places and creates vendor accounts.
 */

const { searchBusinesses } = require('./locationService');
const { syncVendorFromForm } = require('./vendorFormSyncService');
const { uploadFile } = require('./fileService');
const { prisma } = require('../config/db');

/**
 * Fetch a Google Place photo by photo_reference and upload to R2.
 * Returns the public URL or null on failure.
 */
async function fetchAndUploadPlacePhoto(photoReference, apiKey) {
  if (!photoReference || !apiKey) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(photoReference)}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const { url: publicUrl } = await uploadFile(buffer, 'vedika360/vendor-places-photos', { contentType });
    return publicUrl;
  } catch {
    return null;
  }
}

const mapPlaceTypesToCategory = (types = [], fallback = 'other') => {
  const set = new Set((types || []).map((t) => String(t).toLowerCase()));

  if (set.has('caterer') || set.has('meal_delivery') || set.has('meal_takeaway') || set.has('restaurant')) {
    return 'catering';
  }
  if (set.has('florist')) return 'florist';
  if (set.has('wedding_venue') || set.has('event_venue') || set.has('lodging')) return 'venue';
  if (set.has('car_rental') || set.has('taxi_stand') || set.has('travel_agency')) return 'transportation';

  return fallback;
};

const sanitizeId = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40);

const buildSyntheticVendorEmail = (place) => {
  const suffix = sanitizeId(place.placeId || place.name || `${Date.now()}`) || String(Date.now());
  return `vendor+${suffix}@google-place.local`;
};

const buildDescription = (place) => {
  const lines = [
    'Imported from Google Places.',
    place.formattedAddress ? `Address: ${place.formattedAddress}` : '',
    place.rating ? `Rating: ${place.rating}/5 (${place.totalRatings || 0} reviews)` : '',
    Array.isArray(place.types) && place.types.length ? `Google types: ${place.types.join(', ')}` : '',
  ].filter(Boolean);

  return lines.join('\n');
};

const toFormLikePayload = (place, options = {}) => {
  const category = options.forceCategory || mapPlaceTypesToCategory(place.types);
  const email = buildSyntheticVendorEmail(place);

  return {
    email,
    name: place.name || 'Vendor',
    businessName: place.name || 'Vendor Business',
    phone: '',
    category,
    city: place.city || options.city || '',
    state: place.state || options.state || '',
    description: buildDescription(place),
    website: '',
    basePrice: 0,
    priceType: 'custom',
    categoryDetails: {},
  };
};

async function syncVendorsFromGooglePlaces(options = {}) {
  const {
    query,
    city,
    state,
    lat,
    lng,
    radiusMeters = 15000,
    type,
    limit = 100,
    defaultPassword = process.env.VENDOR_DEFAULT_PASSWORD,
    includeCredentials = false,
    forceCategory,
  } = options;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const q = String(query || '').trim() || [type, city, state, 'wedding vendor'].filter(Boolean).join(' ');
  if (!q) {
    throw new Error('Query is required for Google Places sync');
  }

  const { places } = await searchBusinesses({
    query: q,
    lat,
    lng,
    radiusMeters,
    type,
    maxResults: limit,
  });

  const results = {
    query: q,
    discovered: places.length,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    credentials: [],
  };

  for (const place of places.slice(0, limit)) {
    if (!place.name || !String(place.name).trim()) {
      results.skipped += 1;
      continue;
    }
    const payload = toFormLikePayload(place, { city, state, forceCategory });

    const syncResult = await syncVendorFromForm(payload, {
      defaultPassword,
      enforceCategoryDetails: false,
    });

    results.processed += 1;

    if (syncResult.success) {
      results.created += 1;
      if (includeCredentials && syncResult.createdCredentials?.password) {
        results.credentials.push(syncResult.createdCredentials);
      }

      // Fetch and attach cover photo from Google Places if available
      if (place.photoReference && syncResult.vendorId) {
        const photoUrl = await fetchAndUploadPlacePhoto(place.photoReference, apiKey);
        if (photoUrl) {
          await prisma.vendor.update({
            where: { id: syncResult.vendorId },
            data: { coverImage: photoUrl },
          }).catch(() => {}); // Non-fatal
        }
      }
      continue;
    }

    if (syncResult.status === 'already_exists') {
      results.skipped += 1;
      continue;
    }

    results.failed += 1;
    results.errors.push({
      placeId: place.placeId,
      businessName: place.name,
      error: syncResult.error,
    });
  }

  if (!includeCredentials) {
    delete results.credentials;
  }

  return results;
}

module.exports = {
  syncVendorsFromGooglePlaces,
};
