import api from './api';

export const mediaService = {
  uploadMedia: async (eventId, files) => {
    const formData = new FormData();
    formData.append('eventId', eventId);
    files.forEach((file) => {
      formData.append('files', file);
    });
    const response = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getEventMedia: async (eventId, params = {}) => {
    const response = await api.get('/media', { params: { eventId, ...params } });
    return response.data;
  },

  deleteMedia: async (mediaId) => {
    const response = await api.delete(`/media/${mediaId}`);
    return response.data;
  },

  moderateMedia: async (mediaId, approved) => {
    const response = await api.put(`/media/${mediaId}/moderate`, { approved });
    return response.data;
  },

  getGallery: async (eventSlug) => {
    const response = await api.get('/media', { params: { event: eventSlug, approved: true } });
    return response.data;
  },

  uploadPublicBlessing: async ({ eventSlug, guestName, caption, file }) => {
    const formData = new FormData();
    formData.append('eventSlug', eventSlug);
    formData.append('guestName', guestName);
    formData.append('caption', caption || '');
    formData.append('file', file);
    const response = await api.post('/media/public-blessing', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
