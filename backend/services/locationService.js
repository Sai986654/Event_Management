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

module.exports = {
  autocomplete,
  placeDetails,
};
