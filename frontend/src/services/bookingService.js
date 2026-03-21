import api from './api';

export const bookingService = {
  createBooking: async (bookingData) => {
    const response = await api.post('/bookings', bookingData);
    return response.data;
  },

  getBookings: async (params = {}) => {
    const response = await api.get('/bookings', { params });
    return response.data;
  },

  getBookingById: async (bookingId) => {
    const response = await api.get(`/bookings/${bookingId}`);
    return response.data;
  },

  updateBookingStatus: async (bookingId, status) => {
    const response = await api.put(`/bookings/${bookingId}/status`, { status });
    return response.data;
  },

  cancelBooking: async (bookingId) => {
    const response = await api.delete(`/bookings/${bookingId}`);
    return response.data;
  },

  getEventBookings: async (eventId) => {
    const response = await api.get('/bookings', { params: { event: eventId } });
    return response.data;
  },
};
