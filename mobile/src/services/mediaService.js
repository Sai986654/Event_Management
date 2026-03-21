import api from './api';

export const mediaService = {
  getEventMedia: async (eventId, params = {}) => {
    const response = await api.get('/media', { params: { event: eventId, ...params } });
    return response.data;
  },

  uploadPublicBlessing: async ({ eventSlug, guestName, caption, file }) => {
    const formData = new FormData();
    formData.append('eventSlug', eventSlug);
    formData.append('guestName', guestName);
    formData.append('caption', caption || '');
    // React Native: { uri, type, name }; Web: File/Blob
    if (file && typeof file === 'object' && file.uri) {
      formData.append('file', {
        uri: file.uri,
        type: file.type || 'image/jpeg',
        name: file.name || 'blessing.jpg',
      });
    } else {
      formData.append('file', file);
    }
    const response = await api.post('/media/public-blessing', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
