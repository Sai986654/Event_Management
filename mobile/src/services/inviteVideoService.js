import api from './api';

export const inviteVideoService = {
  createInviteJob: async ({ eventId, guests, images = [], music = null, voiceTemplate = '', voiceLang = 'en' }) => {
    const formData = new FormData();
    formData.append('eventId', String(eventId));
    formData.append('guests', JSON.stringify(guests || []));
    if (voiceTemplate) formData.append('voiceTemplate', voiceTemplate);
    if (voiceLang) formData.append('voiceLang', voiceLang);

    images.forEach((asset, idx) => {
      formData.append('images', {
        uri: asset.uri,
        name: asset.fileName || `invite-image-${idx + 1}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    });

    if (music?.uri) {
      formData.append('music', {
        uri: music.uri,
        name: music.fileName || 'music.mp3',
        type: music.mimeType || 'audio/mpeg',
      });
    }

    const response = await api.post('/invite-videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  getJobsByEvent: async (eventId) => {
    const response = await api.get(`/invite-videos/event/${eventId}`);
    return response.data;
  },

  getInviteJob: async (jobId) => {
    const response = await api.get(`/invite-videos/${jobId}`);
    return response.data;
  },

  retryFailedGuests: async (jobId) => {
    const response = await api.post(`/invite-videos/${jobId}/retry`);
    return response.data;
  },
};
