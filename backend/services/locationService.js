const CACHE_TTL_MS = 10 * 60 * 1000;
const AUTO_LIMIT = 7;

const autocompleteCache = new Map();
const placeCache = new Map();

const getCache = (store, key) => {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value;
};

const setCache = (store, key, value) => {
  store.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const mapsKey = () => process.env.GOOGLE_MAPS_API_KEY;

const parseAddressParts = (components = []) => {
  const find = (type) => components.find((c) => Array.isArray(c.types) && c.types.includes(type));
  const city = find('locality') || find('administrative_area_level_2') || find('sublocality');
  const state = find('administrative_area_level_1');
  const country = find('country');
  const postalCode = find('postal_code');

  return {
    city: city?.long_name || '',
    state: state?.long_name || '',
    country: country?.long_name || '',
    postalCode: postalCode?.long_name || '',
  };
};

const autocomplete = async ({ input, sessionToken }) => {
  const query = String(input || '').trim();
  if (query.length < 3) return { suggestions: [], source: 'short-query' };

  const apiKey = mapsKey();
  if (!apiKey) return { suggestions: [], source: 'no-key' };

  const cacheKey = `auto:${query.toLowerCase()}`;
  const cached = getCache(autocompleteCache, cacheKey);
  if (cached) return { suggestions: cached, source: 'cache' };

  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    types: 'geocode',
    components: 'country:in',
  });

  if (sessionToken) params.set('sessiontoken', sessionToken);

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`);
  const body = await response.json();

  const predictions = Array.isArray(body?.predictions) ? body.predictions : [];
  const suggestions = predictions.slice(0, AUTO_LIMIT).map((item) => ({
    placeId: item.place_id,
    description: item.description,
    mainText: item.structured_formatting?.main_text || item.description,
    secondaryText: item.structured_formatting?.secondary_text || '',
  }));

  setCache(autocompleteCache, cacheKey, suggestions);
  return { suggestions, source: 'maps' };
};

const placeDetails = async ({ placeId, sessionToken }) => {
  const id = String(placeId || '').trim();
  if (!id) return null;

  const apiKey = mapsKey();
  if (!apiKey) return null;

  const cacheKey = `place:${id}`;
  const cached = getCache(placeCache, cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    place_id: id,
    key: apiKey,
    fields: 'place_id,name,formatted_address,geometry,address_components',
  });

  if (sessionToken) params.set('sessiontoken', sessionToken);

  const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`);
  const body = await response.json();
  const result = body?.result || null;
  if (!result) return null;

  const parts = parseAddressParts(result.address_components);
  const normalized = {
    placeId: result.place_id,
    name: result.name || '',
    formattedAddress: result.formatted_address || '',
    city: parts.city,
    state: parts.state,
    country: parts.country,
    postalCode: parts.postalCode,
    lat: Number(result.geometry?.location?.lat || 0),
    lng: Number(result.geometry?.location?.lng || 0),
  };

  setCache(placeCache, cacheKey, normalized);
  return normalized;
};

const geocodeCache = new Map();

/**
 * Convert a city+state string into { lat, lng } using Google Geocoding API.
 * Returns null if key is missing or geocoding fails.
 */
const geocode = async (city, state) => {
  const address = [city, state, 'India'].filter(Boolean).join(', ').trim();
  if (!address || address === 'India') return null;

  const apiKey = mapsKey();
  if (!apiKey) return null;

  const cacheKey = `geo:${address.toLowerCase()}`;
  const cached = getCache(geocodeCache, cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    address,
    key: apiKey,
    components: 'country:IN',
  });

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
    const body = await response.json();
    const loc = body?.results?.[0]?.geometry?.location;
    if (!loc) return null;

    const coords = { lat: Number(loc.lat), lng: Number(loc.lng) };
    setCache(geocodeCache, cacheKey, coords);
    return coords;
  } catch {
    return null;
  }
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseCityStateFromAddress = (formattedAddress = '') => {
  const parts = String(formattedAddress)
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return { city: '', state: '' };
  }

  const city = parts[parts.length - 3] || parts[parts.length - 2] || '';
  const stateRaw = parts[parts.length - 2] || '';
  const state = String(stateRaw).replace(/\b\d{5,6}\b/g, '').trim();

  return { city, state };
};

/**
 * Search business listings from Google Places Text Search API.
 */
const searchBusinesses = async ({ query, lat, lng, radiusMeters = 15000, type, maxResults = 60 }) => {
  const q = String(query || '').trim();
  if (!q) return { places: [], source: 'missing-query' };

  const apiKey = mapsKey();
  if (!apiKey) return { places: [], source: 'no-key' };

  const limit = Math.max(1, Math.min(200, Number(maxResults) || 60));
  const places = [];
  let nextPageToken = '';
  let pages = 0;

  while (places.length < limit && pages < 3) {
    const params = new URLSearchParams({
      key: apiKey,
      query: q,
    });

    if (type) params.set('type', String(type).trim());

    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      params.set('location', `${latNum},${lngNum}`);
      params.set('radius', String(Math.max(1000, Math.min(50000, Number(radiusMeters) || 15000))));
    }

    if (nextPageToken) {
      params.set('pagetoken', nextPageToken);
      // Google requires short delay before pagetoken becomes valid.
      await wait(2000);
    }

    const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`);
    const body = await response.json();
    const results = Array.isArray(body?.results) ? body.results : [];

    for (const item of results) {
      if (places.length >= limit) break;
      const parsed = parseCityStateFromAddress(item.formatted_address || '');
      places.push({
        placeId: item.place_id || '',
        name: item.name || '',
        formattedAddress: item.formatted_address || '',
        city: parsed.city,
        state: parsed.state,
        lat: Number(item.geometry?.location?.lat || 0),
        lng: Number(item.geometry?.location?.lng || 0),
        rating: Number(item.rating || 0),
        totalRatings: Number(item.user_ratings_total || 0),
        businessStatus: item.business_status || '',
        types: Array.isArray(item.types) ? item.types : [],
      });
    }

    nextPageToken = String(body?.next_page_token || '').trim();
    if (!nextPageToken) break;
    pages += 1;
  }

  return { places, source: 'maps-textsearch' };
};

module.exports = {
  autocomplete,
  placeDetails,
  geocode,
  searchBusinesses,
};
