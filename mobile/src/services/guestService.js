import api from './api';

export const guestService = {
  addGuest: async (eventId, guestData) => {
    const response = await api.post('/guests', { event: Number(eventId), ...guestData });
    return response.data;
  },

  getEventGuests: async (eventId, params = {}) => {
    const response = await api.get('/guests', { params: { event: Number(eventId), ...params } });
    return response.data;
  },

  updateGuestRsvp: async (guestId, rsvpStatus) => {
    const response = await api.put(`/guests/${guestId}/rsvp`, { rsvpStatus });
    return response.data;
  },

  checkInGuest: async (guestId) => {
    const response = await api.post(`/guests/${guestId}/checkin`);
    return response.data;
  },

  deleteGuest: async (guestId) => {
    const response = await api.delete(`/guests/${guestId}`);
    return response.data;
  },

  bulkImportGuests: async (eventId, csvFile) => {
    const formData = new FormData();
    formData.append('file', csvFile);
    formData.append('eventId', eventId);
    const response = await api.post('/guests/bulk-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getInviteTemplates: async () => {
    const response = await api.get('/guests/invite-templates');
    return response.data;
  },

  generatePersonalizedInvite: async (guestId, payload = {}) => {
    const response = await api.post(`/guests/${guestId}/personalized-invite/generate`, payload);
    return response.data;
  },

  generateBulkPersonalizedInvites: async (eventId, payload = {}) => {
    const response = await api.post('/guests/personalized-invites/generate-bulk', {
      eventId: Number(eventId),
      ...payload,
    });
    return response.data;
  },

  getPersonalizedInvite: async (guestId) => {
    const response = await api.get(`/guests/${guestId}/personalized-invite`);
    return response.data;
  },
};
