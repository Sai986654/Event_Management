/**
 * Vendor Places Sync Service
 *
 * Imports business data from Google Places and creates vendor accounts.
 */

const { searchBusinesses } = require('./locationService');
const { syncVendorFromForm } = require('./vendorFormSyncService');
const { uploadFile } = require('./fileService');
const { prisma } = require('../config/db');

const GOOGLE_TESTIMONIAL_SOURCE = 'Google Places';

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

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseAddressParts = (components = []) => {
  const find = (type) => components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  const city = find('locality') || find('administrative_area_level_2') || find('sublocality');
  const state = find('administrative_area_level_1');
  return {
    city: city?.long_name || '',
    state: state?.long_name || '',
  };
};

const sanitizePhone = (value) => String(value || '').trim().slice(0, 40);

const parseRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(5, Math.round(n)));
};

const toPortfolioEntries = (urls = [], placeName = '') => {
  const now = Date.now();
  return urls.map((url, index) => ({
    id: `google-place-${now}-${index}`,
    url,
    type: 'photo',
    caption: placeName ? `${placeName} (Imported from Google Places)` : 'Imported from Google Places',
    createdAt: new Date().toISOString(),
    source: 'google_places',
    isExternal: false,
  }));
};

const mergePortfolio = (existing, incoming) => {
  const current = Array.isArray(existing) ? existing : [];
  const next = Array.isArray(incoming) ? incoming : [];
  const seen = new Set(current.map((item) => String(item?.url || '').trim()).filter(Boolean));
  const merged = [...current];

  for (const item of next) {
    const key = String(item?.url || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged;
};

async function fetchPlaceDetailsForSync(placeId, apiKey) {
  const id = String(placeId || '').trim();
  if (!id || !apiKey) return null;

  const params = new URLSearchParams({
    place_id: id,
    key: apiKey,
    fields: 'place_id,name,formatted_address,geometry,address_components,formatted_phone_number,international_phone_number,website,reviews,photos,rating,user_ratings_total',
  });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
    if (!response.ok) return null;
    const body = await response.json();
    const result = body?.result;
    if (!result) return null;

    const addr = parseAddressParts(result.address_components);
    const reviews = Array.isArray(result.reviews)
      ? result.reviews
          .map((review) => ({
            clientName: String(review?.author_name || 'Google User').trim() || 'Google User',
            content: String(review?.text || '').trim(),
            rating: parseRating(review?.rating),
          }))
          .filter((review) => review.content)
          .slice(0, 5)
      : [];

    const photoReferences = Array.isArray(result.photos)
      ? result.photos.map((p) => String(p?.photo_reference || '').trim()).filter(Boolean)
      : [];

    return {
      city: addr.city,
      state: addr.state,
      formattedAddress: result.formatted_address || '',
      lat: toNumber(result.geometry?.location?.lat),
      lng: toNumber(result.geometry?.location?.lng),
      phone: sanitizePhone(result.formatted_phone_number || result.international_phone_number || ''),
      website: String(result.website || '').trim(),
      rating: toNumber(result.rating),
      totalRatings: toNumber(result.user_ratings_total),
      reviews,
      photoReferences,
    };
  } catch {
    return null;
  }
}

async function uploadPlacePhotos(photoReferences, apiKey, maxPhotos = 4) {
  const refs = Array.from(new Set((photoReferences || []).filter(Boolean))).slice(0, maxPhotos);
  const urls = [];
  for (const ref of refs) {
    const url = await fetchAndUploadPlacePhoto(ref, apiKey);
    if (url) urls.push(url);
  }
  return urls;
}

async function upsertGoogleTestimonials(vendorId, reviews = []) {
  let created = 0;
  for (const review of reviews) {
    const clientName = String(review.clientName || 'Google User').trim() || 'Google User';
    const content = String(review.content || '').trim();
    if (!content) continue;

    const existing = await prisma.vendorTestimonial.findFirst({
      where: {
        vendorId,
        clientName,
        content,
        source: GOOGLE_TESTIMONIAL_SOURCE,
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.vendorTestimonial.create({
      data: {
        vendorId,
        clientName,
        content,
        rating: parseRating(review.rating),
        source: GOOGLE_TESTIMONIAL_SOURCE,
      },
    });
    created += 1;
  }
  return created;
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
  const namePart = String(place.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 40);
  const suffix = namePart || sanitizeId(place.placeId || '') || String(Date.now());
  return `${suffix}@vedika360.com`;
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
    phone: place.phone || '',
    category,
    city: place.city || options.city || '',
    state: place.state || options.state || '',
    description: buildDescription(place),
    website: place.website || '',
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
    updated: 0,
    testimonialsAdded: 0,
    imagesAdded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    credentials: [],
  };

  for (const basePlace of places.slice(0, limit)) {
    if (!basePlace.name || !String(basePlace.name).trim()) {
      results.skipped += 1;
      continue;
    }

    const details = await fetchPlaceDetailsForSync(basePlace.placeId, apiKey);
    const place = {
      ...basePlace,
      ...(details || {}),
      city: details?.city || basePlace.city,
      state: details?.state || basePlace.state,
      lat: details?.lat ?? basePlace.lat,
      lng: details?.lng ?? basePlace.lng,
      rating: details?.rating ?? basePlace.rating,
      totalRatings: details?.totalRatings ?? basePlace.totalRatings,
      photoReferences: Array.from(
        new Set([
          basePlace.photoReference,
          ...(Array.isArray(details?.photoReferences) ? details.photoReferences : []),
        ].filter(Boolean))
      ),
      reviews: Array.isArray(details?.reviews) ? details.reviews : [],
      phone: details?.phone || '',
      website: details?.website || '',
    };

    const payload = toFormLikePayload(place, { city, state, forceCategory });

    const syncResult = await syncVendorFromForm(payload, {
      defaultPassword,
      enforceCategoryDetails: false,
    });

    results.processed += 1;

    const isCreated = syncResult.success;
    const isExisting = syncResult.status === 'already_exists';

    if (isCreated) {
      results.created += 1;
      if (includeCredentials && syncResult.createdCredentials?.password) {
        results.credentials.push(syncResult.createdCredentials);
      }
    }

    if (isExisting) {
      results.skipped += 1;
    }

    if (!isCreated && !isExisting) {
      results.failed += 1;
      results.errors.push({
        placeId: place.placeId,
        businessName: place.name,
        error: syncResult.error,
      });
      continue;
    }

    const vendorId = syncResult.vendorId;
    if (!vendorId) {
      continue;
    }

    const vendorPatch = {};
    if (place.phone) vendorPatch.contactPhone = place.phone;
    if (place.website) vendorPatch.website = place.website;
    if (payload.city) vendorPatch.city = payload.city;
    if (payload.state) vendorPatch.state = payload.state;
    if (Number.isFinite(place.lat) && Number.isFinite(place.lng) && (place.lat !== 0 || place.lng !== 0)) {
      vendorPatch.latitude = place.lat;
      vendorPatch.longitude = place.lng;
    }
    if (Number.isFinite(place.rating) && place.rating > 0) vendorPatch.averageRating = place.rating;
    if (Number.isFinite(place.totalRatings) && place.totalRatings >= 0) vendorPatch.totalReviews = place.totalRatings;

    const uploadedImageUrls = await uploadPlacePhotos(place.photoReferences, apiKey);
    if (uploadedImageUrls.length > 0) {
      const currentVendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { portfolio: true },
      });
      const incomingPortfolio = toPortfolioEntries(uploadedImageUrls, place.name);
      const beforeCount = Array.isArray(currentVendor?.portfolio) ? currentVendor.portfolio.length : 0;
      const mergedPortfolio = mergePortfolio(currentVendor?.portfolio, incomingPortfolio);
      const afterCount = Array.isArray(mergedPortfolio) ? mergedPortfolio.length : beforeCount;
      vendorPatch.portfolio = mergedPortfolio;
      results.imagesAdded += Math.max(0, afterCount - beforeCount);
    }

    if (Object.keys(vendorPatch).length > 0) {
      await prisma.vendor.update({ where: { id: vendorId }, data: vendorPatch });
      results.updated += 1;
    }

    if (place.reviews.length > 0) {
      const added = await upsertGoogleTestimonials(vendorId, place.reviews);
      results.testimonialsAdded += added;
    }
  }

  if (!includeCredentials) {
    delete results.credentials;
  }

  return results;
}

module.exports = {
  syncVendorsFromGooglePlaces,
};
