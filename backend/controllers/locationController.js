const asyncHandler = require('../utils/asyncHandler');
const locationService = require('../services/locationService');

// GET /api/location/autocomplete?input=hyderabad&sessionToken=...
exports.autocomplete = asyncHandler(async (req, res) => {
  const input = String(req.query.input || '');
  const sessionToken = String(req.query.sessionToken || '');

  const data = await locationService.autocomplete({ input, sessionToken });
  res.json(data);
});

// GET /api/location/place/:placeId?sessionToken=...
exports.placeDetails = asyncHandler(async (req, res) => {
  const placeId = String(req.params.placeId || '');
  const sessionToken = String(req.query.sessionToken || '');

  const place = await locationService.placeDetails({ placeId, sessionToken });
  if (!place) return res.status(404).json({ message: 'Place not found' });
  res.json({ place });
});
