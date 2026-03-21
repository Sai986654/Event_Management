import api from './api';

export const guestService = {
  addGuests: async (eventId, guestData) => {
    const response = await api.post(`/guests`, { eventId, ...guestData });
    return response.data;
  },

  getEventGuests: async (eventId, params = {}) => {
    const response = await api.get('/guests', { params: { eventId, ...params } });
    return response.data;
  },

  updateGuestRsvp: async (guestId, rsvpStatus) => {
    const response = await api.put(`/guests/${guestId}/rsvp`, { status: rsvpStatus });
    return response.data;
  },

  checkInGuest: async (guestId) => {
    const response = await api.post(`/guests/${guestId}/check-in`);
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

  getPublicEventPage: async (eventSlug) => {
    const response = await api.get(`/guests/public/${eventSlug}`);
    return response.data;
  },
};
