import api from './api';

export const locationService = {
  autocomplete: async (input, sessionToken, options = {}) => {
    const { mode = 'geocode', country = 'in' } = options;
    const response = await api.get('/location/autocomplete', {
      params: { input, sessionToken, mode, country },
    });
    return response.data;
  },

  placeDetails: async (placeId, sessionToken) => {
    const response = await api.get(`/location/place/${placeId}`, {
      params: { sessionToken },
    });
    return response.data;
  },
};
