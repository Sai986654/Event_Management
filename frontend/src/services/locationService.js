import api from './api';

export const locationService = {
  autocomplete: async (input, sessionToken) => {
    const response = await api.get('/location/autocomplete', {
      params: { input, sessionToken },
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
