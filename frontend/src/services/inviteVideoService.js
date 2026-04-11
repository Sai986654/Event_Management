import api from './api';

export const inviteVideoService = {
  /** Create a new invite video job (multipart). */
  createJob: async (eventId, images, guests, music = null) => {
    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('guests', JSON.stringify(guests));
    images.forEach((file) => formData.append('images', file));
    if (music) formData.append('music', music);

    const response = await api.post('invite-videos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // 2 min for large uploads
    });
    return response.data;
  },

  /** Get job status + per-guest progress. */
  getJob: async (jobId) => {
    const response = await api.get(`invite-videos/${jobId}`);
    return response.data;
  },

  /** List all jobs for an event. */
  getJobsByEvent: async (eventId) => {
    const response = await api.get(`invite-videos/event/${eventId}`);
    return response.data;
  },

  /** Retry failed guests in a job. */
  retryFailed: async (jobId) => {
    const response = await api.post(`invite-videos/${jobId}/retry`);
    return response.data;
  },
};
