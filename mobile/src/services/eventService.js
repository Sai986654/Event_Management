import api from './api';

export const eventService = {
  createEvent: async (eventData) => {
    const response = await api.post('/events', eventData);
    return response.data;
  },

  getEvents: async (params = {}) => {
    const response = await api.get('/events', { params });
    return response.data;
  },

  getEventById: async (eventId) => {
    const response = await api.get(`/events/${eventId}`);
    return response.data;
  },

  getPublicEventBySlug: async (slug) => {
    const response = await api.get(`/events/slug/${slug}`);
    return response.data;
  },

  updateEvent: async (eventId, eventData) => {
    const response = await api.put(`/events/${eventId}`, eventData);
    return response.data;
  },

  deleteEvent: async (eventId) => {
    const response = await api.delete(`/events/${eventId}`);
    return response.data;
  },
};
