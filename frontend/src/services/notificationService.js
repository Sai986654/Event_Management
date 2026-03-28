import api from './api';

export const notificationService = {
  /** @param {{ contacts?: object[], csv?: string, useOpenAi?: boolean }} payload */
  analyzeContacts: async (payload) => {
    const response = await api.post('/notifications/contacts/analyze', payload);
    return response.data;
  },

  sendWhatsAppReminders: async ({ eventId, group = 'all', message, templateName }) => {
    const response = await api.post(`/notifications/events/${eventId}/reminders/whatsapp`, {
      group,
      message,
      templateName,
    });
    return response.data;
  },

  sendReminder: async (eventId, recipientType) => {
    const response = await api.post('/notifications/send-reminder', {
      eventId,
      recipientType,
    });
    return response.data;
  },

  sendBookingConfirmation: async (bookingId) => {
    const response = await api.post('/notifications/booking-confirmation', { bookingId });
    return response.data;
  },

  sendRsvpConfirmation: async (guestId) => {
    const response = await api.post('/notifications/rsvp-confirmation', { guestId });
    return response.data;
  },

  getNotifications: async (params = {}) => {
    const response = await api.get('/notifications', { params });
    return response.data;
  },

  markAsRead: async (notificationId) => {
    const response = await api.put(`/notifications/${notificationId}/read`);
    return response.data;
  },

  subscribeToUpdates: async (eventId) => {
    const response = await api.post('/notifications/subscribe', { eventId });
    return response.data;
  },
};
