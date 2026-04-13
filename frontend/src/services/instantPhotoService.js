import api from './api';

export const instantPhotoService = {
  // Public — get last N photos for an event
  getLivePhotos: async (eventId, limit = 5) => {
    const response = await api.get(`/instant-photos/live/${eventId}`, { params: { limit } });
    return response.data;
  },

  // Auth — photographer uploads a photo
  uploadPhoto: async (eventId, file, caption = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', eventId);
    if (caption) formData.append('caption', caption);
    const response = await api.post('/instant-photos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
